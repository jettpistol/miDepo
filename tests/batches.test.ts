import { beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { companies, customers, locations, orderLines, orders, pickBatches, pickTasks, products } from "@/db/schema";
import { createCompany, createUser } from "@/db/seed";
import { sync } from "@/lib/fierro";
import { moveStock, zone } from "@/lib/stock";
import type { Ctx } from "@/lib/flows/common";
import { confirmBatchPick, markBatchShort, takeAll } from "@/lib/flows/picking";
import { runLookup } from "@/lib/lookup";

let db: DB;
let c: Ctx;
let loc: Record<string, number>;
let A: typeof products.$inferSelect;
let B: typeof products.$inferSelect;
let customerId: number;
let seq = 0;

/** An order made by hand, so the test knows which titles overlap. */
async function order(day: number, lines: [typeof products.$inferSelect, number][]) {
  seq++;
  const [o] = await db.insert(orders).values({ companyId: c.companyId, fierroId: `T${seq}`, number: `PED-T${seq}`, customerId, date: new Date(Date.UTC(2026, 10, day, 9)) }).returning();
  await db.insert(orderLines).values(lines.map(([p, quantity]) => ({ orderId: o.id, productId: p.id, quantity })));
  return o;
}
const stopsOf = async (batchId: number) =>
  db
    .select({ t: pickTasks, order: orders.number, tray: orders.tray })
    .from(pickTasks)
    .innerJoin(orders, eq(orders.id, pickTasks.orderId))
    .where(and(eq(orders.batchId, batchId), eq(pickTasks.status, "pending")))
    .orderBy(asc(orders.date));

beforeAll(async () => {
  await runMigrations();
  db = await getDb();
  const base = await createCompany(db, { name: "Lotes", slug: "lotes" });
  const [e] = await db.update(companies).set({ simSeed: 7, simTitles: 20, simCustomers: 3, simOrders: 0, simReceipts: 0 }).where(eq(companies.id, base.id)).returning();
  const u = await createUser(db, e.id, { name: "Lotes", email: "lotes@prueba.test", role: "admin", password: "long-password" });
  c = { db, companyId: e.id, userId: u.id };
  await db.insert(locations).values(["A-01-1", "A-01-2", "A-02-1"].map((code) => ({ companyId: e.id, code })));
  await sync(db, e);
  loc = Object.fromEntries((await db.select().from(locations).where(eq(locations.companyId, e.id))).map((l) => [l.code, l.id]));
  [A, B] = await db.select().from(products).where(eq(products.companyId, e.id)).orderBy(asc(products.id)).limit(2);
  customerId = (await db.select().from(customers).where(eq(customers.companyId, e.id)).limit(1))[0].id;
  await moveStock(db, { companyId: e.id, productId: A.id, fromId: null, toId: loc["A-01-1"], quantity: 10, reason: "initial" });
  await moveStock(db, { companyId: e.id, productId: B.id, fromId: null, toId: loc["A-01-2"], quantity: 3, reason: "initial" });
});

describe("picking batches", () => {
  it("takes every pending order in one route, asks for the total per shelf and shares it oldest first", async () => {
    const o1 = await order(1, [[A, 2], [B, 1]]);
    const o2 = await order(2, [[A, 3]]);
    const o3 = await order(3, [[B, 2]]);
    const r = await takeAll(c);
    expect(r.orders).toBe(3);
    expect(r.number).toBe("LOTE-0001");
    await expect(takeAll(c)).rejects.toThrow(/No hay pedidos pendientes/);

    const stops = await stopsOf(r.id);
    const atA = stops.filter((s) => s.t.productId === A.id);
    expect(atA.every((s) => s.t.locationId === loc["A-01-1"])).toBe(true);
    expect(atA.reduce((s, x) => s.concat(x.order), [] as string[])).toEqual([o1.number, o2.number]);

    // The as-you-type check says the same as the action, before the click.
    const ask = (q: Record<string, string | number>) => runLookup(db, c.companyId, new URLSearchParams({ ctx: "batch-picking", batchId: String(r.id), locationId: String(loc["A-01-1"]), productId: String(A.id), ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) }));
    expect((await ask({ location: "A-02-1" })).statuses.location.tone).toBe("danger");
    expect((await ask({ location: "A-01-1", product: A.barcode, quantity: 5 })).statuses).toMatchObject({ location: { tone: "ok" }, product: { tone: "ok" } });
    expect((await ask({ location: "A-01-1", product: B.barcode })).statuses.product.tone).toBe("danger");
    expect((await ask({ location: "A-01-1", product: A.barcode, quantity: 6 })).statuses.quantity.text).toMatch(/pide 5/);

    // Wrong shelf, then 4 of the 5 copies of A: the oldest order is served first.
    await expect(confirmBatchPick(c, { batchId: r.id, locationId: loc["A-01-1"], productId: A.id, location: "A-02-1", product: A.barcode, quantity: 1 })).rejects.toThrow(/otra ubicación/);
    await expect(confirmBatchPick(c, { batchId: r.id, locationId: loc["A-01-1"], productId: A.id, location: "A-01-1", product: A.barcode, quantity: 6 })).rejects.toThrow(/pide 5/);
    expect(await confirmBatchPick(c, { batchId: r.id, locationId: loc["A-01-1"], productId: A.id, location: "A-01-1", product: A.barcode, quantity: 4 })).toMatch(/^4 × /);
    const lineOf = async (orderId: number, productId: number) => (await db.select().from(orderLines).where(and(eq(orderLines.orderId, orderId), eq(orderLines.productId, productId))))[0].picked;
    expect(await lineOf(o1.id, A.id)).toBe(2);
    expect(await lineOf(o2.id, A.id)).toBe(2);
    await confirmBatchPick(c, { batchId: r.id, locationId: loc["A-01-1"], productId: A.id, location: "A-01-1", product: A.barcode, quantity: 1 });
    expect((await db.select().from(orders).where(eq(orders.id, o2.id)))[0].status).toBe("picked");

    // B: 3 asked at A-01-2 but none is there; nowhere else has it, so it stays as a shortage.
    await moveStock(db, { companyId: c.companyId, productId: B.id, fromId: loc["A-01-2"], toId: null, quantity: 3, reason: "initial" });
    expect(await markBatchShort(c, { batchId: r.id, locationId: loc["A-01-2"], productId: B.id })).toMatch(/3 a Faltantes/);
    expect((await db.select().from(orders).where(eq(orders.id, o3.id)))[0].status).toBe("picked");
    expect((await db.select().from(pickBatches).where(eq(pickBatches.id, r.id)))[0].status).toBe("done");
    expect(await stopsOf(r.id)).toHaveLength(0);
    // Everything picked waits in PREPARACIÓN for packing.
    expect((await zone(db, c.companyId, "staging")).code).toBe("PREPARACION");
  });

  it("with trays, numbers the orders and says how many copies go in each", async () => {
    await db.update(companies).set({ batchSorting: "trays" }).where(eq(companies.id, c.companyId));
    const o1 = await order(4, [[A, 1]]);
    const o2 = await order(5, [[A, 2]]);
    const r = await takeAll(c);
    expect(r.number).toBe("LOTE-0002");
    const trays = await db.select({ id: orders.id, tray: orders.tray }).from(orders).where(eq(orders.batchId, r.id)).orderBy(asc(orders.date));
    expect(trays).toEqual([
      { id: o1.id, tray: 1 },
      { id: o2.id, tray: 2 },
    ]);
    const reply = await confirmBatchPick(c, { batchId: r.id, locationId: loc["A-01-1"], productId: A.id, location: "A-01-1", product: A.barcode, quantity: 3 });
    expect(reply).toContain(`Bandeja 1: 1 (${o1.number})`);
    expect(reply).toContain(`Bandeja 2: 2 (${o2.number})`);
    expect(reply).toMatch(/Lote completo/);
  });
});
