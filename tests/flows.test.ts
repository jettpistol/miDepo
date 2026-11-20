import { beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq, sql, sum } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { adjustmentLines, adjustments, boxes, companies, fierroStock, movements, orderLines, orders, products, receivings, stock, pickTasks, locations, suppliers } from "@/db/schema";
import { createCompany, createUser } from "@/db/seed";
import { sync } from "@/lib/fierro";
import { SimulatedFierro } from "@/lib/fierro/simulated";
import { UserError } from "@/lib/errors";
import { moveStock, zone } from "@/lib/stock";
import { generateCodes, TEMPLATES, validateScheme } from "@/lib/locations";
import type { Ctx } from "@/lib/flows/common";
import { cancelReceiving, closeReceiving, createSupplier, createUnannouncedReceiving, deleteSupplier, reopenReceiving, scanReceiving } from "@/lib/flows/receiving";
import { move, recentMoves, undoMove } from "@/lib/flows/move";
import { confirmPick, markShort, planRoute, shortages, releaseOrder, takeOrder, undoShort, unpick } from "@/lib/flows/picking";
import { closeBox, scanIntoBox, finishPacking, removeFromBox, reopenBox, reopenPacking } from "@/lib/flows/packing";
import { cancelReturn, closeReturn, createReturn, reopenReturn, scanReturn } from "@/lib/flows/returns";
import { cancelCount, closeCount, createCount, differences, scanCount, markLocation, needsRecount, planCount, requestRecount } from "@/lib/flows/counts";
import { checkUnit, finishControl, reportMissing, restartControl } from "@/lib/flows/control";
import { saveControlSettings } from "@/lib/flows/settings";
import { undoWriteOff, writeOff } from "@/lib/flows/adjustments";
import { fileFor, markSent, pendingExports, simulateNews } from "@/lib/flows/exports";
import { assign } from "@/lib/flows/assignments";
import { setUrgent } from "@/lib/flows/orders";
import { applyLoad, checkLoad, listLoads, undoLoad } from "@/lib/flows/stockLoad";
import { loadOpenOrders } from "@/app/(app)/picking/Tables";
import { isMine, isUnassigned, openTasks, orderStages, weekActivity } from "@/lib/work";

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

    // The order's page shows the route before it is taken; taking builds exactly that route.
    const preview = await planRoute(db, c.companyId, ord.id);
    // The picking list's shortage count agrees with the route.
    const previewMissing = preview.filter((t) => t.locationId == null).reduce((n, t) => n + t.quantity, 0);
    expect((await shortages(db, c.companyId, [ord.id])).get(ord.id) ?? 0).toBe(previewMissing);
    await takeOrder(c, ord.id);
    const built = await db.select().from(pickTasks).where(eq(pickTasks.orderId, ord.id));
    const key = (t: { lineId: number; locationId: number | null; quantity: number }) => `${t.lineId}:${t.locationId}:${t.quantity}`;
    expect(built.map(key).sort()).toEqual(preview.map(key).sort());
    // Taking it again (an old screen, a second tap) just carries on; someone else is refused.
    await expect(takeOrder(c, ord.id)).resolves.toMatch(/tomado/);
    const intruder = await createUser(db, c.companyId, { name: "Intrusa", email: "intrusa@prueba.test", role: "operator", pin: "135790" });
    await expect(takeOrder({ ...c, userId: intruder.id }, ord.id)).rejects.toThrow(/ya lo tomó/);
    const tasks = await db.select({ t: pickTasks, u: locations.code }).from(pickTasks).innerJoin(locations, eq(locations.id, pickTasks.locationId)).where(eq(pickTasks.orderId, ord.id));
    expect(tasks.reduce((s, t) => s + t.t.quantity, 0)).toBe(lines.reduce((s, l) => s + l.quantity, 0));

    // Picking validations: wrong location, wrong title, too many units.
    const [t0, ...rest] = tasks;
    const other = t0.u === "A-01-2" ? "A-02-1" : "A-01-2";
    await expect(confirmPick(c, { taskId: t0.t.id, location: other, product: prods.get(t0.t.productId)!.barcode, quantity: 1 })).rejects.toThrow(/otra ubicación/);
    const foreign = [...prods.values()].find((p) => p.id !== t0.t.productId)!;
    await expect(confirmPick(c, { taskId: t0.t.id, location: t0.u, product: foreign.barcode, quantity: 1 })).rejects.toThrow(/No es el artículo/);
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
    expect(await markShort(c, pend[0].id)).toMatch(/otra ubicación/i);
    const [newPassword] = await db.select().from(pickTasks).where(and(eq(pickTasks.orderId, ord.id), eq(pickTasks.status, "pending")));
    expect(newPassword.locationId).not.toBe(pend[0].locationId);
    expect(await markShort(c, newPassword.id)).toMatch(/Faltantes/);
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
    // Large differences wait for a second person to recount the shelf.
    await expect(closeCount(c, id)).rejects.toThrow(/sin recontar/);
    await requestRecount(c, id, u1.id);
    await expect(scanCount(c, id, u1.id, prods.get(atU1[0].productId)!.barcode, 1)).rejects.toThrow(/otra persona/);
    const second = await createUser(db, c.companyId, { name: "Segunda", email: "segunda@prueba.test", role: "operator", pin: "246810" });
    const c2 = { ...c, userId: second.id };
    await scanCount(c2, id, u1.id, prods.get(atU1[0].productId)!.barcode, atU1[0].quantity - 2);
    for (const s of atU1.slice(2)) await scanCount(c2, id, u1.id, prods.get(s.productId)!.barcode, s.quantity);
    await markLocation(c2, id, u1.id, true);
    await closeCount(c, id);
    expect(await atLocation(atU1[0].productId, u1.id)).toBe(atU1[0].quantity - 2);
    expect(await atLocation(atU1[1].productId, u1.id)).toBe(0);
    // A-01-2 was not counted: it stays as it was.
    expect(await db.select().from(stock).where(eq(stock.locationId, u2.id))).toEqual(atU2Before);
    const file = await fileFor(db, c.companyId, "count", id);
    expect(file.contents).toContain(",A-01-1");
  });
});

describe("losses, finds and write-offs", () => {
  it("asks for a recount from 5 units or 20% (2 units minimum)", () => {
    expect([needsRecount(10, 5), needsRecount(50, 45), needsRecount(3, 1), needsRecount(0, 2)]).toEqual([true, true, true, true]);
    expect([needsRecount(10, 9), needsRecount(3, 2), needsRecount(50, 46), needsRecount(0, 1)]).toEqual([false, false, false, false]);
  });

  it("tells misplaced units from losses and finds", () => {
    const plan = planCount([
      { productId: 1, locationId: 10, system: 5, countedQty: 2 },
      { productId: 1, locationId: 11, system: 0, countedQty: 2 },
      { productId: 2, locationId: 10, system: 1, countedQty: 2 },
    ]);
    expect(plan.relocations).toEqual([{ productId: 1, fromId: 10, toId: 11, quantity: 2 }]);
    expect(plan.losses).toEqual([{ productId: 1, locationId: 10, quantity: 1 }]);
    expect(plan.found).toEqual([{ productId: 2, locationId: 10, quantity: 1 }]);
  });

  it("a picking shortage moves the units to FALTANTES; a found book comes back with Mover; the rest is written off with a cause", async () => {
    const missingZone = await zone(db, c.companyId, "missing");
    const held = await db.select().from(stock).where(eq(stock.locationId, missingZone.id));
    // The shortage test above reported a title missing from a shelf that had it.
    expect(held.length).toBeGreaterThan(0);
    const [h] = held;
    // One more unit, so that one can turn up and the rest be written off.
    await moveStock(db, { companyId: c.companyId, productId: h.productId, fromId: null, toId: missingZone.id, quantity: 1, reason: "initial" });
    const before = await total(h.productId);
    const [shelf] = await db.select().from(locations).where(and(eq(locations.companyId, c.companyId), eq(locations.code, "A-02-1")));
    const [p] = await db.select().from(products).where(eq(products.id, h.productId));

    await expect(move(c, { source: "A-02-1", product: p.barcode, destination: "FALTANTES", quantity: 1 })).rejects.toThrow(/Faltantes/);
    await move(c, { source: "FALTANTES", product: p.barcode, destination: "A-02-1", quantity: 1 });
    const [last] = await db.select().from(movements).where(eq(movements.productId, p.id)).orderBy(sql`${movements.id} desc`).limit(1);
    expect(last.reason).toBe("found");
    expect(await total(p.id)).toBe(before);

    const left = await atLocation(p.id, missingZone.id);
    await expect(writeOff(c, { locationId: shelf.id, productId: p.id, quantity: 1, cause: "theft_or_loss" })).rejects.toThrow(/Faltantes o en Dañados/);
    await expect(writeOff(c, { locationId: missingZone.id, productId: p.id, quantity: 1, cause: "found" })).rejects.toThrow(/motivo/);
    await expect(writeOff(c, { locationId: missingZone.id, productId: p.id, quantity: left + 1, cause: "theft_or_loss" })).rejects.toBeInstanceOf(UserError);
    expect(await writeOff(c, { locationId: missingZone.id, productId: p.id, quantity: left, cause: "theft_or_loss" })).toMatch(/AJ-\d+.*dado de baja/);
    expect(await total(p.id)).toBe(before - left);

    const pending = (await pendingExports(db, c.companyId)).find((x) => x.type === "adjustment")!;
    const file = await fileFor(db, c.companyId, "adjustment", pending.id);
    expect(file.contents).toContain(`,FALTANTES,-${left},Robo o extravío`);
    const fierroBefore = await fierro(p.id);
    await markSent(c, company, "adjustment", pending.id);
    expect(await fierro(p.id)).toBe(fierroBefore - left);
    await expect(markSent(c, company, "adjustment", pending.id)).rejects.toThrow(/no está pendiente/);
  });

  it("closing a count moves misplaced units, brings back units from FALTANTES and writes off the rest; Fierro hears only the real change", async () => {
    const [l1, l2] = await db.insert(locations).values(["C-01-1", "C-01-2"].map((code) => ({ companyId: c.companyId, code }))).returning();
    const [moved, back, lost] = await db.select().from(products).where(eq(products.companyId, c.companyId)).orderBy(asc(products.id)).offset(40).limit(3);
    const missingZone = await zone(db, c.companyId, "missing");
    for (const p of [moved, back, lost]) await db.delete(stock).where(eq(stock.productId, p.id));
    const put = (productId: number, toId: number, quantity: number) => moveStock(db, { companyId: c.companyId, productId, fromId: null, toId, quantity, reason: "initial" });
    await put(moved.id, l1.id, 10);
    await put(back.id, l1.id, 10);
    await put(back.id, missingZone.id, 1);
    await put(lost.id, l2.id, 10);
    const totals = { moved: await total(moved.id), back: await total(back.id), lost: await total(lost.id) };
    const fierroBefore = { moved: await fierro(moved.id), back: await fierro(back.id), lost: await fierro(lost.id) };

    const id = await createCount(c, "Pasillo C", "C-01");
    await scanCount(c, id, l1.id, moved.barcode, 9);
    await scanCount(c, id, l1.id, back.barcode, 11);
    await scanCount(c, id, l2.id, moved.barcode, 1);
    await scanCount(c, id, l2.id, lost.barcode, 9);
    await markLocation(c, id, l1.id, true);
    await markLocation(c, id, l2.id, true);
    expect(await closeCount(c, id, "damage")).toBe("Conteo cerrado: 1 mal ubicados, 1 aparecieron, 1 dados de baja.");

    expect([await atLocation(moved.id, l1.id), await atLocation(moved.id, l2.id)]).toEqual([9, 1]);
    expect(await atLocation(back.id, missingZone.id)).toBe(0);
    expect({ moved: await total(moved.id), back: await total(back.id), lost: await total(lost.id) }).toEqual({ ...totals, lost: totals.lost - 1 });

    const [adj] = await db.select().from(adjustments).where(eq(adjustments.countId, id));
    expect(await db.select({ productId: adjustmentLines.productId, quantity: adjustmentLines.quantity, cause: adjustmentLines.cause }).from(adjustmentLines).where(eq(adjustmentLines.adjustmentId, adj.id))).toEqual([{ productId: lost.id, quantity: -1, cause: "damage" }]);
    // The count's adjustment is not listed on its own: it reaches Fierro with the count.
    expect((await pendingExports(db, c.companyId)).some((x) => x.type === "adjustment" && x.id === adj.id)).toBe(false);
    await markSent(c, company, "count", id);
    expect({ moved: await fierro(moved.id), back: await fierro(back.id), lost: await fierro(lost.id) }).toEqual({ ...fierroBefore, lost: fierroBefore.lost - 1 });
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

describe("assignments", () => {
  it("gives work to a person, shows it as theirs, and takes it back", async () => {
    const ana = await createUser(db, c.companyId, { name: "Ana Asignada", email: "ana@prueba.test", role: "operator", pin: "864213" });
    const [order] = await db.select().from(orders).where(and(eq(orders.companyId, c.companyId), eq(orders.status, "pending"))).limit(1);
    expect(await assign(c, "order", order.id, ana.id)).toMatch(/Asignado a Ana Asignada/);
    let tasks = await openTasks(db, c.companyId);
    const task = tasks.find((t) => t.kind === "order" && t.id === order.id)!;
    expect(isMine(task, ana.id)).toBe(true);
    expect(isUnassigned(task)).toBe(false);
    expect(await assign(c, "order", order.id, null)).toMatch(/Sin asignar/);
    tasks = await openTasks(db, c.companyId);
    expect(isUnassigned(tasks.find((t) => t.kind === "order" && t.id === order.id)!)).toBe(true);
  });

  it("assigns the put-away of a zone, and the order a person is picking is theirs", async () => {
    const recepcion = await zone(db, c.companyId, "receiving");
    expect(await assign(c, "putaway", recepcion.id, c.userId)).toMatch(/Asignado a/);
    // In a company of its own, so the pending orders later tests rely on stay pending.
    const { e, u } = await buildCompany("Toma SA", "toma", 15);
    const own: Ctx = { db, companyId: e.id, userId: u.id };
    const [order] = await db.select().from(orders).where(and(eq(orders.companyId, e.id), eq(orders.status, "pending"))).limit(1);
    await takeOrder(own, order.id);
    const t = (await openTasks(db, e.id)).find((x) => x.kind === "order" && x.id === order.id)!;
    // Taken: theirs while being picked (or already picked, if the shelves had nothing for it).
    expect(t.verb === "Empacar" || (t.takenBy === u.id && isMine(t, u.id))).toBe(true);
  });

  it("refuses what cannot be assigned", async () => {
    const [shelf] = await db.select().from(locations).where(and(eq(locations.companyId, c.companyId), eq(locations.type, "shelf"))).limit(1);
    await expect(assign(c, "putaway", shelf.id, null)).rejects.toThrow(/No se encontró/);
    await expect(assign(c, "nonsense", 1, null)).rejects.toThrow(/Tipo de tarea desconocido/);
    const [closed] = await db.select().from(receivings).where(and(eq(receivings.companyId, c.companyId), eq(receivings.status, "closed"))).limit(1);
    if (closed) await expect(assign(c, "receiving", closed.id, c.userId)).rejects.toThrow(/sin trabajo pendiente/);
    const [order] = await db.select().from(orders).where(eq(orders.companyId, c.companyId)).limit(1);
    const { e, u } = await buildCompany("Lejana SA", "lejana", 13);
    await expect(assign(c, "order", order.id, u.id)).rejects.toThrow(/Elige una persona/);
    await expect(assign({ db, companyId: e.id, userId: u.id }, "order", order.id, null)).rejects.toThrow(/No se encontró/);
  });

  it("counts orders per stage and units per day for the home page", async () => {
    const stages = await orderStages(db, c.companyId);
    expect(stages.map((s) => s.key)).toEqual(["pending", "in_picking", "to_control", "picked", "packed"]);
    const days = await weekActivity(db, c.companyId);
    expect(days).toHaveLength(7);
    expect(days[6].label).toBe("Hoy");
    // Earlier tests received and picked units today.
    expect(days[6].received + days[6].picked).toBeGreaterThan(0);
  });
});

describe("control before packing", () => {
  let picker: Ctx;
  let checker: Ctx;
  let prods: Map<number, typeof products.$inferSelect>;
  const status = async (id: number) => (await db.select().from(orders).where(eq(orders.id, id)))[0];

  /** Puts the order's units on a shelf and picks them all as `who`. */
  async function pickAll(who: Ctx, orderId: number) {
    const [shelf] = await db.select().from(locations).where(and(eq(locations.companyId, who.companyId), eq(locations.code, "A-01-2")));
    for (const l of await db.select().from(orderLines).where(eq(orderLines.orderId, orderId))) {
      await moveStock(db, { companyId: who.companyId, productId: l.productId, fromId: null, toId: shelf.id, quantity: l.quantity, reason: "initial" });
    }
    await takeOrder(who, orderId);
    for (const t of await db.select().from(pickTasks).where(and(eq(pickTasks.orderId, orderId), eq(pickTasks.status, "pending")))) {
      const [u] = await db.select().from(locations).where(eq(locations.id, t.locationId!));
      await confirmPick(who, { taskId: t.id, location: u.code, product: prods.get(t.productId)!.barcode, quantity: t.quantity });
    }
    return db.select().from(orderLines).where(eq(orderLines.orderId, orderId)).orderBy(asc(orderLines.id));
  }
  const orderUnits = async (id: number) => (await db.select().from(orderLines).where(eq(orderLines.orderId, id))).reduce((s, l) => s + l.quantity, 0);

  beforeAll(async () => {
    const { e, u } = await buildCompany("Control SA", "control", 13);
    await simulateNews(db, e, "orders", 4);
    const second = await createUser(db, e.id, { name: "Segunda", email: "segunda-control@prueba.test", role: "operator", password: "long-password" });
    picker = { db, companyId: e.id, userId: u.id };
    checker = { db, companyId: e.id, userId: second.id };
    prods = new Map((await db.select().from(products).where(eq(products.companyId, e.id))).map((p) => [p.id, p]));
  });

  it("validates the settings", async () => {
    await expect(saveControlSettings(picker, { mode: "large", minUnits: "1", samePerson: true })).rejects.toThrow(UserError);
    await expect(saveControlSettings(picker, { mode: "large", minUnits: "", samePerson: true })).rejects.toThrow(/2 o más/);
    await expect(saveControlSettings(picker, { mode: "otro", samePerson: true })).rejects.toThrow(UserError);
  });

  it("with the step on, a picked order waits in Control, and only someone else can check it", async () => {
    await saveControlSettings(picker, { mode: "all", samePerson: false });
    const [ord] = await db.select().from(orders).where(and(eq(orders.companyId, picker.companyId), eq(orders.status, "pending"))).orderBy(asc(orders.id)).limit(1);
    const lines = await pickAll(picker, ord.id);
    expect((await status(ord.id)).status).toBe("to_control");
    await expect(scanIntoBox(checker, ord.id, prods.get(lines[0].productId)!.barcode, 1)).rejects.toThrow(/no pasó por control/);
    await expect(checkUnit(picker, ord.id, prods.get(lines[0].productId)!.barcode, 1)).rejects.toThrow(/otra persona/);

    const foreign = [...prods.values()].find((p) => !lines.some((l) => l.productId === p.id))!;
    await expect(checkUnit(checker, ord.id, foreign.barcode, 1)).rejects.toThrow(/no está entre lo preparado/);
    await expect(checkUnit(checker, ord.id, prods.get(lines[0].productId)!.barcode, lines[0].picked + 1)).rejects.toThrow(/quedan/);

    // Everything is in the cart except one unit of the first title.
    await checkUnit(checker, ord.id, prods.get(lines[0].productId)!.barcode, 1);
    await restartControl(checker, ord.id);
    expect((await db.select().from(orderLines).where(eq(orderLines.orderId, ord.id))).every((l) => l.checked === 0)).toBe(true);
    for (const [i, l] of lines.entries()) await checkUnit(checker, ord.id, prods.get(l.productId)!.barcode, i === 0 ? l.picked - 1 : l.picked);
    await expect(finishControl(checker, ord.id)).rejects.toThrow(/sin controlar/);
    await expect(reportMissing(checker, ord.id, lines[1]?.id ?? -1)).rejects.toThrow(UserError);

    const staging = await zone(db, picker.companyId, "staging");
    const missingZone = await zone(db, picker.companyId, "missing");
    const before = await atLocation(lines[0].productId, missingZone.id);
    await reportMissing(checker, ord.id, lines[0].id);
    expect(await atLocation(lines[0].productId, missingZone.id)).toBe(before + 1);
    expect(await atLocation(lines[0].productId, staging.id)).toBe(lines[0].picked - 1);
    await finishControl(checker, ord.id);
    const done = await status(ord.id);
    expect(done.status).toBe("picked");
    expect(done.controlledBy).toBe(checker.userId);

    // Controlled by someone else, so the picker may pack it.
    for (const l of await db.select().from(orderLines).where(eq(orderLines.orderId, ord.id))) if (l.picked > 0) await scanIntoBox(picker, ord.id, prods.get(l.productId)!.barcode, l.picked);
    const [box] = await db.select().from(boxes).where(eq(boxes.orderId, ord.id));
    await closeBox(picker, box.id);
    await finishPacking(picker, ord.id);
    expect((await status(ord.id)).packedBy).toBe(picker.userId);
  });

  it("only orders from the threshold up go to Control; otherwise packing is the check", async () => {
    const [ord] = await db.select().from(orders).where(and(eq(orders.companyId, picker.companyId), eq(orders.status, "pending"))).orderBy(asc(orders.id)).limit(1);
    await saveControlSettings(picker, { mode: "large", minUnits: String((await orderUnits(ord.id)) + 1), samePerson: false });
    const lines = await pickAll(picker, ord.id);
    expect((await status(ord.id)).status).toBe("picked");
    await expect(scanIntoBox(picker, ord.id, prods.get(lines[0].productId)!.barcode, 1)).rejects.toThrow(/lo tiene que empacar otra persona/);
    await expect(scanIntoBox(checker, ord.id, prods.get(lines[0].productId)!.barcode, 1)).resolves.toContain("Caja 1");

    // When the same person is allowed, the picker can pack.
    await saveControlSettings(picker, { mode: "large", minUnits: "1000", samePerson: true });
    await expect(scanIntoBox(picker, ord.id, prods.get(lines[0].productId)!.barcode, 1)).resolves.toBeTruthy();
  });

  it("undoing the picking of an order in Control sends it back to picking, and its count starts over", async () => {
    await saveControlSettings(picker, { mode: "all", samePerson: true });
    const [ord] = await db.select().from(orders).where(and(eq(orders.companyId, picker.companyId), eq(orders.status, "pending"))).orderBy(asc(orders.id)).limit(1);
    const lines = await pickAll(picker, ord.id);
    // One unit of the first article is not in the cart: it goes to FALTANTES and off the route.
    for (const l of lines.slice(1)) await checkUnit(checker, ord.id, prods.get(l.productId)!.barcode, l.picked);
    if (lines[0].picked > 1) await checkUnit(checker, ord.id, prods.get(lines[0].productId)!.barcode, lines[0].picked - 1);
    await reportMissing(checker, ord.id, lines[0].id);
    const staging = await zone(db, picker.companyId, "staging");
    const routeUnits = async () => (await db.select().from(pickTasks).where(eq(pickTasks.orderId, ord.id))).reduce((s, t) => s + t.picked, 0);
    const lineUnits = async () => (await db.select().from(orderLines).where(eq(orderLines.orderId, ord.id))).reduce((s, l) => s + l.picked, 0);
    expect(await routeUnits()).toBe(await lineUnits());

    const [done] = await db.select().from(pickTasks).where(and(eq(pickTasks.orderId, ord.id), eq(pickTasks.lineId, lines[1].id)));
    await unpick(picker, done.id);
    const back = await status(ord.id);
    expect(back.status).toBe("in_picking");
    expect((await db.select().from(orderLines).where(eq(orderLines.orderId, ord.id))).every((l) => l.checked === 0)).toBe(true);

    // Dropping it returns exactly what is in Preparación: nothing left behind, nothing missing.
    const before = await Promise.all(lines.map((l) => atLocation(l.productId, staging.id)));
    await releaseOrder(picker, ord.id);
    const after = await Promise.all(lines.map((l) => atLocation(l.productId, staging.id)));
    expect(after.every((n, i) => n <= before[i] && n >= 0)).toBe(true);
    expect((await status(ord.id)).status).toBe("pending");
  });

  it("turning the step off sends waiting orders to packing", async () => {
    await saveControlSettings(picker, { mode: "all", samePerson: true });
    const [ord] = await db.select().from(orders).where(and(eq(orders.companyId, picker.companyId), eq(orders.status, "pending"))).orderBy(asc(orders.id)).limit(1);
    await pickAll(picker, ord.id);
    expect((await status(ord.id)).status).toBe("to_control");
    await expect(saveControlSettings(picker, { mode: "packing", samePerson: true })).resolves.toMatch(/1 pedido/);
    expect((await status(ord.id)).status).toBe("picked");
  });
});

describe("several companies", () => {
  it("one company neither sees nor touches another's data", async () => {
    const { e, u } = await buildCompany("Otra SRL", "otra", 9);
    const other: Ctx = { db, companyId: e.id, userId: u.id };
    const [foreignOrder] = await db.select().from(orders).where(and(eq(orders.companyId, c.companyId), eq(orders.status, "pending"))).limit(1);
    await expect(takeOrder(other, foreignOrder.id)).rejects.toThrow(/No se encontró/);
    const [foreignProduct] = await db.select().from(products).where(eq(products.companyId, c.companyId)).limit(1);
    await expect(move(other, { source: "RECEPCION", product: foreignProduct.barcode, destination: "A-01-1", quantity: 1 })).rejects.toThrow(/no está en el catálogo/);
    await expect(fileFor(db, e.id, "order", foreignOrder.id)).rejects.toThrow(/No se encontró/);
    expect(await pendingExports(db, e.id)).toHaveLength(0);
  });

  it("simulating new orders in Fierro brings them in on sync", async () => {
    const before = (await db.select().from(orders).where(eq(orders.companyId, c.companyId))).length;
    const r = await simulateNews(db, company, "orders", 4);
    expect(r.newOrders).toBe(4);
    expect((await db.select().from(orders).where(eq(orders.companyId, c.companyId))).length).toBe(before + 4);
  });
});

describe("going back", () => {
  let u: Ctx;
  let prods: Map<number, typeof products.$inferSelect>;
  const shelf = async (code: string) => (await db.select().from(locations).where(and(eq(locations.companyId, u.companyId), eq(locations.code, code))))[0];

  beforeAll(async () => {
    const { e, u: user } = await buildCompany("Deshacer SA", "deshacer", 21);
    u = { db, companyId: e.id, userId: user.id };
    prods = new Map((await db.select().from(products).where(eq(products.companyId, e.id))).map((p) => [p.id, p]));
  });

  it("an order can be dropped half picked: units go back to their shelf and it returns to Pendientes", async () => {
    const [ord] = await db.select().from(orders).where(and(eq(orders.companyId, u.companyId), eq(orders.status, "pending"))).orderBy(asc(orders.id)).limit(1);
    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, ord.id));
    const a1 = await shelf("A-01-1");
    const a2 = await shelf("A-01-2");
    for (const l of lines) await moveStock(db, { companyId: u.companyId, productId: l.productId, fromId: null, toId: a1.id, quantity: l.quantity, reason: "initial" });
    // The first title also has a spare unit elsewhere, so a shortage report finds it.
    await moveStock(db, { companyId: u.companyId, productId: lines[0].productId, fromId: null, toId: a2.id, quantity: lines[0].quantity, reason: "initial" });

    await takeOrder(u, ord.id);
    const tasks = await db.select().from(pickTasks).where(eq(pickTasks.orderId, ord.id)).orderBy(asc(pickTasks.id));
    const [t0, t1] = tasks;
    await confirmPick(u, { taskId: t0.id, location: "A-01-1", product: prods.get(t0.productId)!.barcode, quantity: t0.quantity });
    expect(await atLocation(t0.productId, a1.id)).toBe(0);

    // Undo one pick: the stop is pending again and the units are back.
    expect(await unpick(u, t0.id)).toMatch(/A-01-1/);
    expect(await atLocation(t0.productId, a1.id)).toBe(t0.quantity);
    await expect(unpick(u, t0.id)).rejects.toThrow(/todavía no se tomó/);

    // "Not here", then "it was there after all": the units leave FALTANTES and the extra stop goes.
    const missingZone = await zone(db, u.companyId, "missing");
    expect(await markShort(u, t0.id)).toMatch(/otra ubicación/i);
    expect(await atLocation(t0.productId, missingZone.id)).toBe(t0.quantity);
    expect((await db.select().from(pickTasks).where(eq(pickTasks.replacesTaskId, t0.id))).length).toBe(1);
    await undoShort(u, t0.id);
    expect(await atLocation(t0.productId, missingZone.id)).toBe(0);
    expect(await atLocation(t0.productId, a1.id)).toBe(t0.quantity);
    expect((await db.select().from(pickTasks).where(eq(pickTasks.replacesTaskId, t0.id))).length).toBe(0);
    expect((await db.select().from(pickTasks).where(eq(pickTasks.id, t0.id)))[0].status).toBe("pending");

    // Somebody else cannot drop it; its picker can.
    if (t1) await confirmPick(u, { taskId: t1.id, location: "A-01-1", product: prods.get(t1.productId)!.barcode, quantity: 1 });
    await expect(releaseOrder({ ...u, userId: u.userId + 999 }, ord.id)).rejects.toThrow(/Solo esa persona/);
    expect(await releaseOrder(u, ord.id)).toMatch(/vuelve a Pendientes/);
    const [after] = await db.select().from(orders).where(eq(orders.id, ord.id));
    expect(after.status).toBe("pending");
    expect(after.takenBy).toBeNull();
    expect(await db.select().from(pickTasks).where(eq(pickTasks.orderId, ord.id))).toHaveLength(0);
    for (const l of lines) expect((await db.select().from(orderLines).where(eq(orderLines.id, l.id)))[0].picked).toBe(0);
    expect(await atLocation(lines[0].productId, a1.id)).toBe(lines[0].quantity);
    await expect(releaseOrder(u, ord.id)).rejects.toThrow(/Nadie está preparando/);
  });

  it("packing can be gone back over until the order is loaded in Fierro", async () => {
    const [ord] = await db.select().from(orders).where(and(eq(orders.companyId, u.companyId), eq(orders.status, "pending"))).orderBy(asc(orders.id)).limit(1);
    await takeOrder(u, ord.id);
    const tasks = await db.select({ t: pickTasks, code: locations.code }).from(pickTasks).innerJoin(locations, eq(locations.id, pickTasks.locationId)).where(eq(pickTasks.orderId, ord.id));
    for (const { t, code } of tasks) await confirmPick(u, { taskId: t.id, location: code, product: prods.get(t.productId)!.barcode, quantity: t.quantity });
    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, ord.id));
    await scanIntoBox(u, ord.id, prods.get(lines[0].productId)!.barcode, lines[0].quantity);
    const [box] = await db.select().from(boxes).where(eq(boxes.orderId, ord.id));
    await expect(releaseOrder(u, ord.id)).rejects.toThrow(/cajas armadas/);
    await expect(unpick(u, tasks.find((x) => x.t.productId === lines[0].productId)!.t.id)).rejects.toThrow(/en una caja/);
    await removeFromBox(u, box.id, lines[0].productId);
    expect((await db.select().from(orderLines).where(eq(orderLines.id, lines[0].id)))[0].packed).toBe(0);
    for (const l of lines) await scanIntoBox(u, ord.id, prods.get(l.productId)!.barcode, l.quantity);
    await closeBox(u, box.id);
    await reopenBox(u, box.id);
    await closeBox(u, box.id);
    await finishPacking(u, ord.id);
    await reopenPacking(u, ord.id);
    expect((await db.select().from(orders).where(eq(orders.id, ord.id)))[0].status).toBe("picked");
    await finishPacking(u, ord.id);
    const [e] = await db.select().from(companies).where(eq(companies.id, u.companyId));
    await markSent(u, e, "order", ord.id);
    await expect(reopenPacking(u, ord.id)).rejects.toThrow(/No se puede reabrir/);
  });

  it("a receiving or a return can be cancelled while open and reopened while its units have not moved", async () => {
    const [sup] = await db.select().from(suppliers).where(eq(suppliers.companyId, u.companyId)).limit(1);
    const id = await createUnannouncedReceiving(u, sup.id);
    const [r] = await db.select().from(receivings).where(eq(receivings.id, id));
    expect(await cancelReceiving(u, id)).toMatch(/cancelada/);
    // The next one gets the same number: nothing ever shares one.
    const id2 = await createUnannouncedReceiving(u, sup.id);
    expect((await db.select().from(receivings).where(eq(receivings.id, id2)))[0].number).toBe(r.number);
    const p = [...prods.values()][5];
    await scanReceiving(u, id2, p.barcode, 3);
    await closeReceiving(u, id2);
    const dock = await zone(db, u.companyId, "receiving");
    const before = await atLocation(p.id, dock.id);
    await move(u, { source: "RECEPCION", product: p.barcode, destination: "A-02-1", quantity: 1 });
    await expect(reopenReceiving(u, id2)).rejects.toThrow(/ya se guardó/);
    // Undo that move, then the receiving reopens and its units leave.
    const [m] = await recentMoves(db, u.companyId, u.userId);
    await undoMove(u, m.id);
    await expect(undoMove(u, m.id)).rejects.toThrow(/ya se deshizo/);
    expect((await recentMoves(db, u.companyId, u.userId))[0].undone).toBe(true);
    await reopenReceiving(u, id2);
    expect(await atLocation(p.id, dock.id)).toBe(before - 3);

    const [cust] = await db.select().from(orders).where(eq(orders.companyId, u.companyId)).limit(1);
    const ret = await createReturn(u, cust.customerId);
    await scanReturn(u, ret, p.barcode, "damaged", 2);
    await closeReturn(u, ret);
    await reopenReturn(u, ret);
    const damaged = await zone(db, u.companyId, "damaged");
    expect(await atLocation(p.id, damaged.id)).toBe(0);
    await cancelReturn(u, ret);
  });

  it("a write-off from Bajas can be undone until Fierro hears of it; a count can be cancelled while open", async () => {
    const damaged = await zone(db, u.companyId, "damaged");
    const p = [...prods.values()][7];
    await moveStock(db, { companyId: u.companyId, productId: p.id, fromId: null, toId: damaged.id, quantity: 2, reason: "initial" });
    await writeOff(u, { locationId: damaged.id, productId: p.id, quantity: 2, cause: "damage" });
    const [a] = await db.select().from(adjustments).where(eq(adjustments.companyId, u.companyId)).orderBy(sql`${adjustments.id} desc`).limit(1);
    await undoWriteOff(u, a.id);
    expect(await atLocation(p.id, damaged.id)).toBe(2);
    await writeOff(u, { locationId: damaged.id, productId: p.id, quantity: 1, cause: "damage" });
    const [b] = await db.select().from(adjustments).where(eq(adjustments.companyId, u.companyId)).orderBy(sql`${adjustments.id} desc`).limit(1);
    expect(b.number).toBe(a.number);
    const [e] = await db.select().from(companies).where(eq(companies.id, u.companyId));
    await markSent(u, e, "adjustment", b.id);
    await expect(undoWriteOff(u, b.id)).rejects.toThrow(/ya se cargó/);

    const k = await createCount(u, "Prueba", "A-01");
    expect(await cancelCount(u, k)).toMatch(/cancelado/);
  });

  it("a supplier created by mistake can be deleted while nothing uses it", async () => {
    const s = await createSupplier(u, "Distribuidora Equivocada");
    expect(await deleteSupplier(u, s.id)).toMatch(/borrado/);
    const [fromFierro] = await db.select().from(suppliers).where(and(eq(suppliers.companyId, u.companyId), sql`${suppliers.createdBy} is null`)).limit(1);
    await expect(deleteSupplier(u, fromFierro.id)).rejects.toThrow(/Fierro/);
  });
});

describe("orders that Fierro changes", () => {
  it("follows Fierro for orders nobody started, flags started ones, and never takes an incomplete order", async () => {
    const { e, u: user } = await buildCompany("Cambios SA", "cambios", 31);
    const u: Ctx = { db, companyId: e.id, userId: user.id };
    const real = new SimulatedFierro(db, e);
    const original = await real.pendingOrders();
    expect(original.length).toBe(3);
    const books = await real.books();
    const [a, b, gone] = original;
    // Someone starts picking order a; give it stock first so the route has a stop.
    const [shelf] = await db.select().from(locations).where(and(eq(locations.companyId, e.id), eq(locations.code, "A-01-1")));
    const productOf = new Map((await db.select().from(products).where(eq(products.companyId, e.id))).map((p) => [p.fierroId, p.id]));
    for (const l of a.lines) await db.transaction((tx) => moveStock(tx, { companyId: e.id, productId: productOf.get(l.bookId)!, fromId: null, toId: shelf.id, quantity: l.quantity, reason: "initial" }));
    const [orderA] = await db.select().from(orders).where(and(eq(orders.companyId, e.id), eq(orders.fierroId, a.id)));
    await takeOrder(u, orderA.id);

    // Fierro now: a and b edited, `gone` cancelled, and a new order naming an article not in its catalogue.
    const edited = (o: typeof a) => ({ ...o, lines: [...o.lines, { bookId: books[50].id, quantity: 2 }] });
    const fresh = { ...b, id: "NEW-1", number: "P-NEW-1", lines: [{ bookId: books[1].id, quantity: 1 }, { bookId: "NOT-IN-CATALOGUE", quantity: 1 }] };
    const later = Object.assign(Object.create(real), { pendingOrders: async () => [edited(a), edited(b), fresh] });
    const r = await sync(db, e, later);
    expect(r).toMatchObject({ newOrders: 1, changedOrders: 1, cancelledOrders: 1, flaggedOrders: 1 });

    const byId = async (f: string) => (await db.select().from(orders).where(and(eq(orders.companyId, e.id), eq(orders.fierroId, f))))[0];
    expect((await byId(a.id)).fierroChange).toBe("changed");
    expect((await db.select().from(orderLines).where(eq(orderLines.orderId, orderA.id))).length).toBe(a.lines.length);
    const orderB = await byId(b.id);
    expect(orderB.status).toBe("pending");
    expect((await db.select().from(orderLines).where(eq(orderLines.orderId, orderB.id))).some((l) => l.productId === productOf.get(books[50].id))).toBe(true);
    const cancelled = await byId(gone.id);
    expect(cancelled.status).toBe("cancelled");
    await expect(takeOrder(u, cancelled.id)).rejects.toThrow(/PICK-19|ya no figura/);
    const incomplete = await byId("NEW-1");
    expect(incomplete.unknownLines).toBe(1);
    await expect(takeOrder(u, incomplete.id)).rejects.toThrow(UserError);

    // Released, the edited order is refused until a sync applies the change, then follows Fierro.
    await releaseOrder(u, orderA.id);
    await expect(takeOrder(u, orderA.id)).rejects.toThrow(UserError);
    await sync(db, e, later);
    expect((await byId(a.id)).fierroChange).toBeNull();
    expect((await db.select().from(orderLines).where(eq(orderLines.orderId, orderA.id))).length).toBe(a.lines.length + 1);

    // A cancelled order Fierro lists again comes back; an empty answer from Fierro cancels nothing.
    await sync(db, e, Object.assign(Object.create(real), { pendingOrders: async () => [edited(a), edited(b), fresh, gone] }));
    expect((await byId(gone.id)).status).toBe("pending");
    await sync(db, e, Object.assign(Object.create(real), { pendingOrders: async () => [] }));
    expect((await byId(gone.id)).status).toBe("pending");
  });
});

describe("urgent orders", () => {
  it("a supervisor marks an order urgent and it goes first in the queue; not once packed", async () => {
    const { e, u: user } = await buildCompany("Urgente SA", "urgente", 41);
    const u: Ctx = { db, companyId: e.id, userId: user.id };
    const pending = await db.select().from(orders).where(and(eq(orders.companyId, e.id), eq(orders.status, "pending"))).orderBy(asc(orders.date));
    const last = pending[pending.length - 1];
    await setUrgent(u, last.id, true);
    const { pending: queue } = await loadOpenOrders(db, e.id);
    expect(queue[0].p.id).toBe(last.id);
    await setUrgent(u, last.id, false);
    expect((await loadOpenOrders(db, e.id)).pending[0].p.id).toBe(pending[0].id);
    await db.update(orders).set({ status: "packed" }).where(eq(orders.id, last.id));
    await expect(setUrgent(u, last.id, true)).rejects.toThrow(/ORD-02|empacado/);
    const other = await buildCompany("Ajena SA", "ajena-urg", 42);
    await expect(setUrgent({ db, companyId: other.e.id, userId: other.u.id }, pending[0].id, true)).rejects.toThrow(UserError);
  });
});

describe("opening stock load", () => {
  it("checks every row, loads only a clean file, and can be undone while nothing moved", async () => {
    const { e, u: user } = await buildCompany("Inicial SA", "inicial", 51);
    const u: Ctx = { db, companyId: e.id, userId: user.id };
    const [p1, p2] = await db.select().from(products).where(eq(products.companyId, e.id)).orderBy(asc(products.id)).limit(2);
    const bad = `Ubicación;Cantidad;Código\nA-01-1;5;${p1.barcode}\na-01-2;x;${p2.internalCode.toLowerCase()}\nZ-99;1;${p1.barcode}\nA-01-1;2;NOPE`;
    const r = await checkLoad(db, e.id, bad);
    expect(r.lines).toBe(4);
    expect(r.rows.map((x) => !!x.error)).toEqual([false, true, true, true]);
    await expect(applyLoad(u, bad, "malo.csv")).rejects.toThrow(/STK-18|errores/);

    const good = `${p1.barcode},5,A-01-1\n${p2.internalCode},3,a-01-2\n${p1.isbn ?? p1.barcode},2,A-01-1`;
    expect((await checkLoad(db, e.id, good)).errors).toBe(0);
    await applyLoad(u, good, "bueno.csv");
    expect(await atLocation(p1.id, (await db.select().from(locations).where(and(eq(locations.companyId, e.id), eq(locations.code, "A-01-1"))))[0].id)).toBe(7);
    expect(await total(p2.id)).toBe(3);
    // Opening stock is not a document for Fierro.
    expect((await pendingExports(db, e.id)).some((x) => x.type === "adjustment")).toBe(false);
    const [load] = await listLoads(db, e.id);
    expect(load.l).toMatchObject({ lines: 3, units: 10 });

    // Once part of it moved, it can no longer be undone; put back, it can.
    const a1 = (await db.select().from(locations).where(and(eq(locations.companyId, e.id), eq(locations.code, "A-01-1"))))[0];
    const a2 = (await db.select().from(locations).where(and(eq(locations.companyId, e.id), eq(locations.code, "A-02-1"))))[0];
    await db.transaction((tx) => moveStock(tx, { companyId: e.id, productId: p1.id, fromId: a1.id, toId: a2.id, quantity: 1, reason: "movement" }));
    await expect(undoLoad(u, load.l.id)).rejects.toThrow(/STK-21|ya se movió/);
    await db.transaction((tx) => moveStock(tx, { companyId: e.id, productId: p1.id, fromId: a2.id, toId: a1.id, quantity: 1, reason: "movement" }));
    await undoLoad(u, load.l.id);
    expect(await total(p1.id)).toBe(0);
    await expect(undoLoad(u, load.l.id)).rejects.toThrow(/ya se deshizo/);
  });
});
