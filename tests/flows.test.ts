import { beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq, sql, sum } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { boxes, companies, fierroStock, orderLines, orders, products, receivings, stock, pickTasks, locations, suppliers } from "@/db/schema";
import { createCompany, createUser } from "@/db/seed";
import { sync } from "@/lib/fierro";
import { UserError } from "@/lib/errors";
import { moveStock, zone } from "@/lib/stock";
import { generateCodes, TEMPLATES, validateScheme } from "@/lib/locations";
import type { Ctx } from "@/lib/flows/common";
import { closeReceiving, createSupplier, createUnannouncedReceiving, scanReceiving } from "@/lib/flows/receiving";
import { move } from "@/lib/flows/move";
import { confirmPick, markShort, takeOrder } from "@/lib/flows/picking";
import { closeBox, scanIntoBox, finishPacking } from "@/lib/flows/packing";
import { closeReturn, createReturn, scanReturn } from "@/lib/flows/returns";
import { closeCount, createCount, differences, scanCount, markLocation } from "@/lib/flows/counts";
import { fileFor, markSent, pendingExports, simulateNews } from "@/lib/flows/exports";

let db: DB;
let c: Ctx;
let company: typeof companies.$inferSelect;

const total = async (productId: number) => Number((await db.select({ n: sum(stock.quantity) }).from(stock).where(eq(stock.productId, productId)))[0].n ?? 0);
const atLocation = async (productId: number, locationId: number) => (await db.select().from(stock).where(and(eq(stock.productId, productId), eq(stock.locationId, locationId))))[0]?.quantity ?? 0;
const fierro = async (productId: number) => (await db.select().from(fierroStock).where(eq(fierroStock.productId, productId)))[0]?.quantity ?? 0;

async function buildCompany(name: string, slug: string, seedNum: number) {
  const base = await createCompany(db, { name, slug });
  const [e] = await db.update(companies).set({ simSeed: seedNum, simTitles: 60, simCustomers: 5, simOrders: 3, simReceipts: 1 }).where(eq(companies.id, base.id)).returning();
  const u = await createUser(db, e.id, { name: "Prueba", email: `${slug}@prueba.test`, role: "admin", password: "long-password" });
  await db.insert(locations).values(["A-01-1", "A-01-2", "A-02-1"].map((code) => ({ companyId: e.id, code })));
  await sync(db, e);
  return { e, u };
}

beforeAll(async () => {
  await runMigrations();
  db = await getDb();
  const { e, u } = await buildCompany("Prueba SA", "prueba", 3);
  company = e;
  c = { db, companyId: e.id, userId: u.id };
});

describe("locations", () => {
  it("generates each template's codes without repeats", () => {
    for (const m of TEMPLATES) {
      const codes = generateCodes(m.scheme);
      expect(new Set(codes).size).toBe(codes.length);
      expect(validateScheme(m.scheme)).toBeNull();
    }
    expect(generateCodes(TEMPLATES[0].scheme)[0]).toBe("A-01-1");
    expect(generateCodes(TEMPLATES[1].scheme)[0]).toBe("E01-1");
  });
});

describe("stock", () => {
  it("never leaves a location negative", async () => {
    const [p] = await db.select().from(products).where(eq(products.companyId, c.companyId)).limit(1);
    const [u] = await db.select().from(locations).where(and(eq(locations.companyId, c.companyId), eq(locations.code, "A-01-1")));
    await expect(moveStock(db, { companyId: c.companyId, productId: p.id, fromId: u.id, toId: null, quantity: 1, reason: "movement" })).rejects.toBeInstanceOf(UserError);
  });
});

describe("full circuit", () => {
  it("receives, puts away, picks, packs and ships, and Fierro ends up matching the warehouse", async () => {
    // Receiving of the receipt announced by Fierro, with everything expected.
    const [rec] = await db.select().from(receivings).where(eq(receivings.companyId, c.companyId));
    const recLines = await db.query.receivingLines.findMany({ where: (l, { eq }) => eq(l.receivingId, rec.id) }).catch(() => null);
    expect(recLines).not.toBeNull();
    const prods = new Map((await db.select().from(products).where(eq(products.companyId, c.companyId))).map((p) => [p.id, p]));
    for (const l of recLines!) await scanReceiving(c, rec.id, prods.get(l.productId)!.barcode, l.expected);
    await closeReceiving(c, rec.id);
    await expect(scanReceiving(c, rec.id, prods.get(recLines![0].productId)!.barcode, 1)).rejects.toThrow(/cerrada/);
    const receiving = await zone(db, c.companyId, "receiving");
    expect(await atLocation(recLines![0].productId, receiving.id)).toBe(recLines![0].expected);

    // Put-away: everything received goes to A-01-1. Without shelf stock no picking is possible.
    for (const l of recLines!) await move(c, { source: "RECEPCION", product: prods.get(l.productId)!.barcode, destination: "a-01-1", quantity: l.expected });
    expect(await atLocation(recLines![0].productId, receiving.id)).toBe(0);
    await markSent(c, company, "receiving", rec.id);
    expect(await fierro(recLines![0].productId)).toBe(recLines![0].expected);

    // So the order can be picked, we put stock of its titles in two locations.
    const [ord] = await db.select().from(orders).where(eq(orders.companyId, c.companyId)).orderBy(asc(orders.id)).limit(1);
    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, ord.id));
    const [a2] = await db.select().from(locations).where(and(eq(locations.companyId, c.companyId), eq(locations.code, "A-02-1")));
    const before = new Map<number, number>();
    for (const l of lines) {
      await moveStock(db, { companyId: c.companyId, productId: l.productId, fromId: null, toId: a2.id, quantity: l.quantity, reason: "initial" });
      await db.insert(fierroStock).values({ companyId: c.companyId, productId: l.productId, quantity: l.quantity }).onConflictDoUpdate({ target: [fierroStock.companyId, fierroStock.productId], set: { quantity: sql`${fierroStock.quantity} + ${l.quantity}` } });
      before.set(l.productId, await total(l.productId));
    }

    await takeOrder(c, ord.id);
    await expect(takeOrder(c, ord.id)).rejects.toThrow(/ya lo tomó/);
    const tasks = await db.select({ t: pickTasks, u: locations.code }).from(pickTasks).innerJoin(locations, eq(locations.id, pickTasks.locationId)).where(eq(pickTasks.orderId, ord.id));
    expect(tasks.reduce((s, t) => s + t.t.quantity, 0)).toBe(lines.reduce((s, l) => s + l.quantity, 0));

    // Picking validations: wrong location, wrong title, too many units.
    const [t0, ...rest] = tasks;
    const other = t0.u === "A-01-2" ? "A-02-1" : "A-01-2";
    await expect(confirmPick(c, { taskId: t0.t.id, location: other, product: prods.get(t0.t.productId)!.barcode, quantity: 1 })).rejects.toThrow(/otra ubicación/);
    const foreign = [...prods.values()].find((p) => p.id !== t0.t.productId)!;
    await expect(confirmPick(c, { taskId: t0.t.id, location: t0.u, product: foreign.barcode, quantity: 1 })).rejects.toThrow(/No es el título/);
    await expect(confirmPick(c, { taskId: t0.t.id, location: t0.u, product: prods.get(t0.t.productId)!.barcode, quantity: t0.t.quantity + 1 })).rejects.toThrow(/pide/);

    for (const t of [t0, ...rest]) await confirmPick(c, { taskId: t.t.id, location: t.u, product: prods.get(t.t.productId)!.barcode, quantity: t.t.quantity });
    expect((await db.select().from(orders).where(eq(orders.id, ord.id)))[0].status).toBe("picked");
    // What was picked stays inside the warehouse until shipment.
    for (const l of lines) expect(await total(l.productId)).toBe(before.get(l.productId));

    // Packing: it accepts neither foreign titles nor more units than were picked.
    await expect(scanIntoBox(c, ord.id, [...prods.values()].find((p) => !lines.some((l) => l.productId === p.id))!.barcode, 1)).rejects.toThrow(/no está entre lo preparado/);
    await expect(scanIntoBox(c, ord.id, prods.get(lines[0].productId)!.barcode, lines[0].quantity + 1)).rejects.toThrow(/quedan/);
    for (const l of lines) await scanIntoBox(c, ord.id, prods.get(l.productId)!.barcode, l.quantity);
    await expect(finishPacking(c, ord.id)).rejects.toThrow(/caja abierta/);
    const [box] = await db.select().from(boxes).where(eq(boxes.orderId, ord.id));
    await closeBox(c, box.id);
    await finishPacking(c, ord.id);

    const pending = await pendingExports(db, c.companyId);
    expect(pending.map((p) => p.type)).toContain("order");
    const file = await fileFor(db, c.companyId, "order", ord.id);
    expect(file.contents.split("\r\n").filter(Boolean).length).toBe(lines.length + 1);

    await markSent(c, company, "order", ord.id);
    for (const l of lines) {
      expect(await total(l.productId)).toBe(before.get(l.productId)! - l.quantity);
      expect(await fierro(l.productId)).toBe(await total(l.productId));
    }
    await expect(markSent(c, company, "order", ord.id)).rejects.toThrow(/no está listo/);
  });

  it("a shortage looks for the title in another location and, if there is none, lets the order carry on", async () => {
    const [ord] = await db.select().from(orders).where(and(eq(orders.companyId, c.companyId), eq(orders.status, "pending"))).limit(1);
    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, ord.id));
    const us = await db.select().from(locations).where(and(eq(locations.companyId, c.companyId), eq(locations.type, "shelf"))).orderBy(asc(locations.code));
    // The first title ends up split across two places, each of which is enough on its own.
    for (const u of us.slice(1, 3)) await moveStock(db, { companyId: c.companyId, productId: lines[0].productId, fromId: null, toId: u.id, quantity: lines[0].quantity, reason: "initial" });
    // We empty whatever there was of the rest to force shortages.
    for (const l of lines.slice(1)) await db.delete(stock).where(eq(stock.productId, l.productId));
    await db.delete(stock).where(and(eq(stock.productId, lines[0].productId), eq(stock.locationId, us[0].id)));

    await takeOrder(c, ord.id);
    const pend = await db.select().from(pickTasks).where(and(eq(pickTasks.orderId, ord.id), eq(pickTasks.status, "pending")));
    expect(pend).toHaveLength(1);
    expect(await markShort(c, pend[0].id)).toMatch(/otra ubicación/);
    const [newPassword] = await db.select().from(pickTasks).where(and(eq(pickTasks.orderId, ord.id), eq(pickTasks.status, "pending")));
    expect(newPassword.locationId).not.toBe(pend[0].locationId);
    expect(await markShort(c, newPassword.id)).toMatch(/faltante/);
    expect((await db.select().from(orders).where(eq(orders.id, ord.id)))[0].status).toBe("picked");
  });
});

describe("returns and counts", () => {
  it("a return sends each book where its condition calls for", async () => {
    const [p] = await db.select().from(products).where(eq(products.companyId, c.companyId)).orderBy(asc(products.id)).limit(1);
    const cust = (await db.query.customers.findFirst({ where: (k, { eq }) => eq(k.companyId, c.companyId) }))!;
    const before = await total(p.id);
    const id = await createReturn(c, cust.id);
    await scanReturn(c, id, p.barcode, "sellable", 3);
    await scanReturn(c, id, p.barcode, "damaged", 2);
    await scanReturn(c, id, p.barcode, "sellable", 1);
    await expect(scanReturn(c, id, p.barcode, "regular", 1)).rejects.toThrow(/estado/);
    await closeReturn(c, id);
    expect(await atLocation(p.id, (await zone(db, c.companyId, "returns")).id)).toBe(4);
    expect(await atLocation(p.id, (await zone(db, c.companyId, "damaged")).id)).toBe(2);
    expect(await total(p.id)).toBe(before + 6);
  });

  it("a count adjusts only the counted locations", async () => {
    const [u1] = await db.select().from(locations).where(and(eq(locations.companyId, c.companyId), eq(locations.code, "A-01-1")));
    const [u2] = await db.select().from(locations).where(and(eq(locations.companyId, c.companyId), eq(locations.code, "A-01-2")));
    const atU1 = await db.select().from(stock).where(eq(stock.locationId, u1.id));
    expect(atU1.length).toBeGreaterThan(1);
    const atU2Before = await db.select().from(stock).where(eq(stock.locationId, u2.id));
    const prods = new Map((await db.select().from(products).where(eq(products.companyId, c.companyId))).map((p) => [p.id, p]));

    const id = await createCount(c, "Pasillo A", "a-01");
    // At A-01-1: the first title has 2 fewer, the second is absent, the rest match.
    await scanCount(c, id, u1.id, prods.get(atU1[0].productId)!.barcode, atU1[0].quantity - 2);
    for (const s of atU1.slice(2)) await scanCount(c, id, u1.id, prods.get(s.productId)!.barcode, s.quantity);
    await markLocation(c, id, u1.id, true);
    await expect(scanCount(c, id, u1.id, prods.get(atU1[0].productId)!.barcode, 1)).rejects.toThrow(/ya se dio por contada/);

    const diffs = (await differences(db, id)).filter((d) => d.system !== d.countedQty);
    expect(diffs).toHaveLength(2);
    await closeCount(c, id);
    expect(await atLocation(atU1[0].productId, u1.id)).toBe(atU1[0].quantity - 2);
    expect(await atLocation(atU1[1].productId, u1.id)).toBe(0);
    // A-01-2 was not counted: it stays as it was.
    expect(await db.select().from(stock).where(eq(stock.locationId, u2.id))).toEqual(atU2Before);
    const file = await fileFor(db, c.companyId, "count", id);
    expect(file.contents).toContain(",A-01-1");
  });
});

describe("suppliers", () => {
  it("fills the supplier list from Fierro's receipts on sync", async () => {
    const list = await db.select().from(suppliers).where(eq(suppliers.companyId, c.companyId));
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => s.createdBy === null)).toBe(true);
  });

  it("only accepts a supplier from the list for an unannounced receiving", async () => {
    await expect(createUnannouncedReceiving(c, NaN)).rejects.toBeInstanceOf(UserError);
    await expect(createUnannouncedReceiving(c, 999999)).rejects.toBeInstanceOf(UserError);
    const [s] = await db.select().from(suppliers).where(eq(suppliers.companyId, c.companyId)).limit(1);
    const id = await createUnannouncedReceiving(c, s.id);
    expect((await db.select().from(receivings).where(eq(receivings.id, id)))[0].supplierId).toBe(s.id);
  });

  it("creates a supplier on purpose but refuses near-copies and junk", async () => {
    const created = await createSupplier(c, "  Editorial   Nórdica ");
    expect(created.name).toBe("Editorial Nórdica");
    await expect(createSupplier(c, "editorial nordica")).rejects.toThrow(/Ya existe: Editorial Nórdica/);
    await expect(createSupplier(c, "Editorial Nordicaa")).rejects.toThrow(/casi igual/);
    await expect(createSupplier(c, "Editorial Sur")).resolves.toMatchObject({ name: "Editorial Sur" });
    await expect(createSupplier(c, "x")).rejects.toBeInstanceOf(UserError);
    await expect(createSupplier(c, "12345")).rejects.toBeInstanceOf(UserError);
  });

  it("does not let one company use another company's supplier", async () => {
    const { e, u } = await buildCompany("Ajena SRL", "ajena", 11);
    const [foreign] = await db.select().from(suppliers).where(eq(suppliers.companyId, e.id)).limit(1);
    expect(foreign).toBeDefined();
    await expect(createUnannouncedReceiving(c, foreign.id)).rejects.toBeInstanceOf(UserError);
    expect(u.companyId).toBe(e.id);
  });
});

describe("several companies", () => {
  it("one company neither sees nor touches another's data", async () => {
    const { e, u } = await buildCompany("Otra SRL", "otra", 9);
    const other: Ctx = { db, companyId: e.id, userId: u.id };
    const [foreignOrder] = await db.select().from(orders).where(and(eq(orders.companyId, c.companyId), eq(orders.status, "pending"))).limit(1);
    await expect(takeOrder(other, foreignOrder.id)).rejects.toThrow(/No encuentro/);
    const [foreignProduct] = await db.select().from(products).where(eq(products.companyId, c.companyId)).limit(1);
    await expect(move(other, { source: "RECEPCION", product: foreignProduct.barcode, destination: "A-01-1", quantity: 1 })).rejects.toThrow(/No conozco el código/);
    await expect(fileFor(db, e.id, "order", foreignOrder.id)).rejects.toThrow(/No encuentro/);
    expect(await pendingExports(db, e.id)).toHaveLength(0);
  });

  it("simulating new orders in Fierro brings them in on sync", async () => {
    const before = (await db.select().from(orders).where(eq(orders.companyId, c.companyId))).length;
    const r = await simulateNews(db, company, "orders", 4);
    expect(r.newOrders).toBe(4);
    expect((await db.select().from(orders).where(eq(orders.companyId, c.companyId))).length).toBe(before + 4);
  });
});
