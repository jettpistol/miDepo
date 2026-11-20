import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { companies, customers, labelJobs, printers, printLog, products, workstations } from "@/db/schema";
import { createCompany, createUser } from "@/db/seed";
import { sync } from "@/lib/fierro";
import type { Ctx } from "@/lib/flows/common";
import { discardLabels, pendingLabels, resolveSource, restoreLabels } from "@/lib/flows/labels";
import { assignPrinter, createPrinter, sendLabels, setDemoFault, setTestMode, targetFor } from "@/lib/flows/printers";
import { closeReceiving, createSupplier, createUnannouncedReceiving, scanReceiving } from "@/lib/flows/receiving";
import { closeReturn, createReturn, scanReturn } from "@/lib/flows/returns";

let db: DB;
let c: Ctx & { company: { name: string } };
let station: number;

beforeAll(async () => {
  await runMigrations();
  db = await getDb();
  const base = await createCompany(db, { name: "Etiquetas SA", slug: "etiquetas" });
  const [e] = await db.update(companies).set({ simSeed: 9, simTitles: 80, simCustomers: 3, simOrders: 0, simReceipts: 0 }).where(eq(companies.id, base.id)).returning();
  const u = await createUser(db, e.id, { name: "Supervisora", email: "sup@etiquetas.test", role: "supervisor", password: "long-password" });
  await sync(db, e);
  c = { db, companyId: e.id, userId: u.id, company: { name: e.name } };
  [{ id: station }] = await db.insert(workstations).values({ companyId: e.id, token: "test-token", name: "Muelle" }).returning();
});

describe("labels prepared by the steps", () => {
  it("a receiving prepares one label per unit of the articles without ISBN; a return, one per unit with its grade", async () => {
    const all = await db.select().from(products).where(eq(products.companyId, c.companyId));
    const own = all.find((p) => !p.isbn)!;
    const withIsbn = all.find((p) => p.isbn)!;
    expect(own && withIsbn).toBeTruthy();
    const supplier = await createSupplier(c, "Distribuidora Prueba");
    const r = await createUnannouncedReceiving(c, supplier.id);
    await scanReceiving(c, r, own.barcode, 3);
    await scanReceiving(c, r, withIsbn.barcode, 5);
    expect(await closeReceiving(c, r)).toMatch(/3 etiquetas por imprimir/);
    const [job] = await db.select().from(labelJobs).where(eq(labelJobs.source, `receiving:${r}`));
    expect(job).toMatchObject({ kind: "item", total: 3, automatic: true });

    const [cust] = await db.select().from(customers).where(eq(customers.companyId, c.companyId)).limit(1);
    const ret = await createReturn(c, cust.id);
    await scanReturn(c, ret, withIsbn.barcode, "clearance", 2);
    await closeReturn(c, ret);
    const src = await resolveSource(db, c.companyId, c.company.name, `job:${(await db.select().from(labelJobs).where(eq(labelJobs.source, `return:${ret}`)))[0].id}`);
    expect(src.labels).toMatchObject([{ kind: "condition", copies: 2, data: { grade: "SALDO" } }]);
    expect(await pendingLabels(db, c.companyId)).toBe(2);
  });
});

describe("printers", () => {
  it("test mode adds demo printers that keep the program, fail on a simulated fault, and hide when it is off", async () => {
    await setTestMode(c, true);
    const demo = await db.select().from(printers).where(and(eq(printers.companyId, c.companyId), eq(printers.connection, "demo")));
    expect(demo.map((p) => p.language).sort()).toEqual(["tspl", "tspl", "zpl"]);
    const zebra = demo.find((p) => p.language === "zpl")!;

    // A4 sheets only through the dialog; a size too small for the kind is refused.
    await expect(assignPrinter(c, station, "item", zebra.id, "a4-24")).rejects.toThrow(/diálogo/);
    await expect(assignPrinter(c, station, "box", zebra.id, "50x25")).rejects.toThrow(/insuficiente/);
    await assignPrinter(c, station, "item", zebra.id, "50x25");
    expect((await targetFor(db, c.companyId, station, "item")).printer?.id).toBe(zebra.id);

    const [job] = await db.select().from(labelJobs).where(and(eq(labelJobs.companyId, c.companyId), eq(labelJobs.kind, "item"), isNull(labelJobs.printedAt)));
    const sent = await sendLabels(c, { source: `job:${job.id}`, printerId: zebra.id, sizeId: "50x25", workstationId: station });
    expect(sent).toEqual({ dialog: false, message: `3 etiquetas a ${zebra.name}.` });
    const [log] = await db.select().from(printLog).where(eq(printLog.jobId, job.id));
    expect(log.program).toMatch(/^\^XA/);
    expect(log.program).toContain("^PQ3");
    expect((await db.select().from(labelJobs).where(eq(labelJobs.id, job.id)))[0]).toMatchObject({ prints: 1 });

    await setDemoFault(c, zebra.id, "paper");
    await expect(sendLabels(c, { source: "test", printerId: zebra.id, sizeId: "50x25", workstationId: station })).rejects.toThrow(/sin papel/);
    await setDemoFault(c, zebra.id, "");

    // The dialog route: logged, and the page prints itself.
    expect(await sendLabels(c, { source: "test", printerId: null, sizeId: "a4-24", workstationId: station })).toEqual({ dialog: true });

    await setTestMode(c, false);
    expect((await targetFor(db, c.companyId, station, "item")).printer).toBeNull();
    await expect(sendLabels(c, { source: "test", printerId: zebra.id, sizeId: "50x25", workstationId: station })).rejects.toThrow(/desactivada/);
  });

  it("refuses a printer whose name nearly repeats another; discards and restores a job", async () => {
    expect(await createPrinter(c, { name: "Zebra del muelle", modelId: "zebra-zd230" })).toMatch(/agregada/);
    await expect(createPrinter(c, { name: "Zebra del mulle", modelId: "zebra-zd230" })).rejects.toThrow(/Ya existe/);
    await expect(createPrinter(c, { name: "Otra", modelId: "nada" })).rejects.toThrow(/modelo/);
    const [job] = await db.select().from(labelJobs).where(and(eq(labelJobs.companyId, c.companyId), isNull(labelJobs.printedAt)));
    await discardLabels(c, job.id);
    await expect(discardLabels(c, job.id)).rejects.toThrow(/pendientes/);
    await expect(sendLabels(c, { source: `job:${job.id}`, printerId: null, sizeId: "50x25", workstationId: station })).rejects.toThrow(/descartadas/);
    await restoreLabels(c, job.id);
    expect(await pendingLabels(db, c.companyId)).toBe(1);
  });
});
