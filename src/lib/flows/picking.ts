import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { companies, orderLines, orders, pickBatches, stock, pickTasks, locations } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, findLocation, moveStock, zone } from "../stock";
import { validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

async function orderOf(c: Ctx, id: number) {
  const [p] = await c.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.companyId, c.companyId)));
  if (!p) throw new UserError("PICK-01", "No se encontró ese pedido.");
  return p;
}

/**
 * Shelf stock available for a title: what is there minus what is already promised
 * to pending stops of other orders. Sorted to empty the places with the least first.
 */
async function available(tx: Executor, companyId: number, productIds: number[], exclude: Set<number | null> = new Set()) {
  if (productIds.length === 0) return new Map<number, { locationId: number; free: number }[]>();
  const rows = await tx
    .select({ productId: stock.productId, locationId: stock.locationId, quantity: stock.quantity })
    .from(stock)
    .innerJoin(locations, eq(locations.id, stock.locationId))
    .where(and(eq(stock.companyId, companyId), inArray(stock.productId, productIds), eq(locations.type, "shelf"), eq(locations.active, true)));
  const promised = await tx
    .select({ productId: pickTasks.productId, locationId: pickTasks.locationId, n: sql<number>`sum(${pickTasks.quantity} - ${pickTasks.picked})`.mapWith(Number) })
    .from(pickTasks)
    .where(and(inArray(pickTasks.productId, productIds), eq(pickTasks.status, "pending")))
    .groupBy(pickTasks.productId, pickTasks.locationId);
  const reserved = new Map(promised.map((r) => [`${r.productId}:${r.locationId}`, r.n]));
  const lookupMap = new Map<number, { locationId: number; free: number }[]>();
  for (const f of rows) {
    if (exclude.has(f.locationId)) continue;
    const free = f.quantity - (reserved.get(`${f.productId}:${f.locationId}`) ?? 0);
    if (free > 0) lookupMap.set(f.productId, [...(lookupMap.get(f.productId) ?? []), { locationId: f.locationId, free }]);
  }
  for (const l of lookupMap.values()) l.sort((a, b) => a.free - b.free);
  return lookupMap;
}

/** Splits a quantity across locations. Returns the stops and whatever could not be covered. */
function distribute(places: { locationId: number; free: number }[], quantity: number) {
  // If a single place is enough, go there and avoid an extra stop.
  const unique = places.find((l) => l.free >= quantity);
  if (unique) return { stops: [{ locationId: unique.locationId, quantity }], missing: 0 };
  const stops: { locationId: number; quantity: number }[] = [];
  let missing = quantity;
  for (const l of [...places].sort((a, b) => b.free - a.free)) {
    if (missing === 0) break;
    const volume = Math.min(l.free, missing);
    stops.push({ locationId: l.locationId, quantity: volume });
    missing -= volume;
  }
  return { stops, missing };
}

/** The operator takes a pending order: the route through the shelves is built. */
export async function takeOrder(c: Ctx, orderId: number) {
  const p = await orderOf(c, orderId);
  return c.db.transaction(async (tx) => {
    // The status change goes first and is conditional: if two people act at once, only one wins.
    const taken = await tx.update(orders).set({ status: "in_picking", takenBy: c.userId }).where(and(eq(orders.id, orderId), eq(orders.status, "pending"))).returning({ id: orders.id });
    if (taken.length === 0) {
      // Already yours (an old screen, or a second tap): carry on with it.
      if (p.status === "in_picking" && p.takenBy === c.userId) return `Pedido ${p.number} tomado.`;
      throw new UserError("PICK-02", "Ese pedido ya lo tomó otra persona.");
    }
    await buildRoute(tx, c.companyId, orderId);
    return `Pedido ${p.number} tomado.`;
  });
}

/**
 * The stops of an order: for each line, the shelves that have it free. Stops already promised to
 * other orders (including earlier orders of the same batch, in this transaction) are not counted.
 */
async function buildRoute(tx: Executor, companyId: number, orderId: number) {
  const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  const freeOnes = await available(tx, companyId, lines.map((l) => l.productId));
  const tasks: (typeof pickTasks.$inferInsert)[] = [];
  for (const l of lines) {
    const { stops, missing } = distribute(freeOnes.get(l.productId) ?? [], l.quantity);
    for (const s of stops) tasks.push({ orderId, lineId: l.id, productId: l.productId, locationId: s.locationId, quantity: s.quantity });
    if (missing > 0) tasks.push({ orderId, lineId: l.id, productId: l.productId, locationId: null, quantity: missing, status: "short" });
  }
  if (tasks.length > 0) await tx.insert(pickTasks).values(tasks);
  await checkEnd(tx, orderId);
}

async function checkEnd(tx: Executor, orderId: number) {
  const [remains] = await tx.select({ id: pickTasks.id }).from(pickTasks).where(and(eq(pickTasks.orderId, orderId), eq(pickTasks.status, "pending"))).limit(1);
  if (!remains) await tx.update(orders).set({ status: "picked" }).where(and(eq(orders.id, orderId), eq(orders.status, "in_picking")));
  return !remains;
}

async function taskOf(c: Ctx, taskId: number) {
  const [t] = await c.db
    .select({ task: pickTasks, order: orders })
    .from(pickTasks)
    .innerJoin(orders, eq(orders.id, pickTasks.orderId))
    .where(and(eq(pickTasks.id, taskId), eq(orders.companyId, c.companyId)));
  if (!t) throw new UserError("PICK-03", "No se encontró esa parada del recorrido.");
  if (t.task.status !== "pending") throw new UserError("PICK-04", "Esa parada ya está resuelta.");
  return t;
}

/** Confirms a stop: checks that the location and the title scanned are the ones asked for. */
export async function confirmPick(c: Ctx, d: { taskId: number; location: string; product: string; quantity: unknown }) {
  const n = validQuantity(d.quantity);
  const { task, order } = await taskOf(c, d.taskId);
  const u = await findLocation(c.db, c.companyId, d.location);
  if (u.id !== task.locationId) throw new UserError("PICK-05", `Estás en ${u.code}, pero esta parada es en otra ubicación. Revisa la etiqueta.`);
  const p = await findProduct(c.db, c.companyId, d.product);
  if (p.id !== task.productId) throw new UserError("PICK-06", `Ese es "${articleName(p.title)}". No es el artículo que pide esta parada.`);
  const remaining = task.quantity - task.picked;
  if (n > remaining) throw new UserError("PICK-07", `Esta parada pide ${remaining}. Si tomaste de más, devuelve ${n - remaining} a la ubicación.`);

  return c.db.transaction(async (tx) => {
    const prep = await zone(tx, c.companyId, "staging");
    await moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: u.id, toId: prep.id, quantity: n, reason: "picking", reference: order.number, userId: c.userId });
    await tx.update(pickTasks).set({ picked: task.picked + n, status: n === remaining ? "done" : "pending" }).where(eq(pickTasks.id, task.id));
    await tx.update(orderLines).set({ picked: sql`${orderLines.picked} + ${n}` }).where(eq(orderLines.id, task.lineId));
    const end = await checkEnd(tx, order.id);
    return end ? `Pedido ${order.number} completo. Llévalo a empaque.` : `${n} × ${articleName(p.title)} ✓`;
  });
}

/**
 * The operator reports that what is missing is not at the location. Those units move from the shelf
 * to FALTANTES (still owned, not written off: a count may find them, a supervisor may write them off).
 * miDepo looks for the title elsewhere; if there is none, the stop is left as a shortage.
 */
export async function markShort(c: Ctx, taskId: number) {
  const { task, order } = await taskOf(c, taskId);
  const missing = task.quantity - task.picked;
  return c.db.transaction(async (tx) => {
    await tx.update(pickTasks).set({ status: "short" }).where(eq(pickTasks.id, task.id));
    if (task.locationId != null) {
      const [onShelf] = await tx.select({ n: stock.quantity }).from(stock).where(and(eq(stock.productId, task.productId), eq(stock.locationId, task.locationId)));
      const gone = Math.min(onShelf?.n ?? 0, missing);
      if (gone > 0) {
        const missingZone = await zone(tx, c.companyId, "missing");
        await moveStock(tx, { companyId: c.companyId, productId: task.productId, fromId: task.locationId, toId: missingZone.id, quantity: gone, reason: "missing", reference: order.number, userId: c.userId });
      }
    }
    // The operator is not sent back to a place where they already reported this title was missing.
    const alreadyFailed = await tx.select({ u: pickTasks.locationId }).from(pickTasks).where(and(eq(pickTasks.lineId, task.lineId), eq(pickTasks.status, "short")));
    const freeOnes = await available(tx, c.companyId, [task.productId], new Set(alreadyFailed.map((f) => f.u)));
    const { stops, missing: uncovered } = distribute(freeOnes.get(task.productId) ?? [], missing);
    if (stops.length > 0) {
      await tx.insert(pickTasks).values(stops.map((s) => ({ orderId: order.id, lineId: task.lineId, productId: task.productId, locationId: s.locationId, quantity: s.quantity })));
    }
    await checkEnd(tx, order.id);
    if (stops.length > 0 && uncovered === 0) return "Registrado. El artículo está en otra ubicación y se sumó al recorrido.";
    if (stops.length > 0) return `Registrado. Hay una parte en otra ubicación; ${uncovered} quedan como faltante.`;
    return `Registrado: ${missing} quedan como faltante. Conviene contar esa ubicación.`;
  });
}


// ───────────── Batches: several orders in one walk ─────────────

export const batchNumber = (n: number) => `LOTE-${String(n).padStart(4, "0")}`;

/**
 * "Preparar todos": every pending order, oldest first, goes into one batch for this person. The
 * company's setting says whether the units are split into orders at packing or into trays now.
 */
export async function takeAll(c: Ctx) {
  return c.db.transaction(async (tx) => {
    const [company] = await tx.select({ sorting: companies.batchSorting }).from(companies).where(eq(companies.id, c.companyId));
    const [{ last }] = await tx.select({ last: sql<number>`coalesce(max(${pickBatches.number}), 0)`.mapWith(Number) }).from(pickBatches).where(eq(pickBatches.companyId, c.companyId));
    const [batch] = await tx.insert(pickBatches).values({ companyId: c.companyId, number: last + 1, takenBy: c.userId, sorting: company.sorting }).returning();
    // Conditional, like takeOrder: an order someone else takes at the same moment stays theirs.
    const taken = await tx
      .update(orders)
      .set({ status: "in_picking", takenBy: c.userId, batchId: batch.id })
      .where(and(eq(orders.companyId, c.companyId), eq(orders.status, "pending")))
      .returning({ id: orders.id, date: orders.date });
    if (taken.length === 0) throw new UserError("PICK-08", "No hay pedidos pendientes para preparar.");
    taken.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id);
    // Oldest first: when stock is short, the oldest orders get it.
    for (const [i, o] of taken.entries()) {
      if (batch.sorting === "trays") await tx.update(orders).set({ tray: i + 1 }).where(eq(orders.id, o.id));
      await buildRoute(tx, c.companyId, o.id);
    }
    await checkBatchEnd(tx, batch.id);
    return { id: batch.id, number: batchNumber(batch.number), orders: taken.length };
  });
}

async function batchOf(c: Ctx, batchId: number) {
  const [b] = await c.db.select().from(pickBatches).where(and(eq(pickBatches.id, batchId), eq(pickBatches.companyId, c.companyId)));
  if (!b) throw new UserError("PICK-09", "No se encontró ese lote.");
  return b;
}

/** The pending tasks of one stop of a batch (a shelf and a title), oldest order first. */
async function stopTasks(tx: Executor, batchId: number, locationId: number, productId: number) {
  return tx
    .select({ task: pickTasks, order: orders })
    .from(pickTasks)
    .innerJoin(orders, eq(orders.id, pickTasks.orderId))
    .where(and(eq(orders.batchId, batchId), eq(pickTasks.status, "pending"), eq(pickTasks.locationId, locationId), eq(pickTasks.productId, productId)))
    .orderBy(asc(orders.date), asc(orders.id), asc(pickTasks.id));
}

/** The batch is done when no order in it has a stop left. */
async function checkBatchEnd(tx: Executor, batchId: number) {
  const [left] = await tx
    .select({ id: pickTasks.id })
    .from(pickTasks)
    .innerJoin(orders, eq(orders.id, pickTasks.orderId))
    .where(and(eq(orders.batchId, batchId), eq(pickTasks.status, "pending")))
    .limit(1);
  if (!left) await tx.update(pickBatches).set({ status: "done" }).where(eq(pickBatches.id, batchId));
  return !left;
}

export type TrayShare = { tray: number | null; order: string; quantity: number };

/**
 * Confirms a stop of a batch: the shelf and the title must be the stop's, and the units scanned
 * are shared among its orders, oldest first. With trays, the reply says how many go in each.
 */
export async function confirmBatchPick(c: Ctx, d: { batchId: number; locationId: number; productId: number; location: string; product: string; quantity: unknown }) {
  const n = validQuantity(d.quantity);
  const batch = await batchOf(c, d.batchId);
  const tasks = await stopTasks(c.db, batch.id, d.locationId, d.productId);
  if (tasks.length === 0) throw new UserError("PICK-04", "Esa parada ya está resuelta.");
  const u = await findLocation(c.db, c.companyId, d.location);
  if (u.id !== d.locationId) throw new UserError("PICK-05", `Estás en ${u.code}, pero esta parada es en otra ubicación. Revisa la etiqueta.`);
  const p = await findProduct(c.db, c.companyId, d.product);
  if (p.id !== d.productId) throw new UserError("PICK-06", `Ese es "${articleName(p.title)}". No es el artículo que pide esta parada.`);
  const remaining = tasks.reduce((s, t) => s + t.task.quantity - t.task.picked, 0);
  if (n > remaining) throw new UserError("PICK-07", `Esta parada pide ${remaining}. Si tomaste de más, devuelve ${n - remaining} a la ubicación.`);

  return c.db.transaction(async (tx) => {
    const prep = await zone(tx, c.companyId, "staging");
    const shares: TrayShare[] = [];
    let left = n;
    for (const { task, order } of tasks) {
      if (left === 0) break;
      const take = Math.min(left, task.quantity - task.picked);
      left -= take;
      await moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: u.id, toId: prep.id, quantity: take, reason: "picking", reference: order.number, userId: c.userId });
      await tx.update(pickTasks).set({ picked: task.picked + take, status: take === task.quantity - task.picked ? "done" : "pending" }).where(eq(pickTasks.id, task.id));
      await tx.update(orderLines).set({ picked: sql`${orderLines.picked} + ${take}` }).where(eq(orderLines.id, task.lineId));
      await checkEnd(tx, order.id);
      const same = shares.find((s) => s.order === order.number);
      if (same) same.quantity += take;
      else shares.push({ tray: order.tray, order: order.number, quantity: take });
    }
    const end = await checkBatchEnd(tx, batch.id);
    const where = batch.sorting === "trays" ? shares.map((s) => ` · Bandeja ${s.tray}: ${s.quantity} (${s.order})`).join("") : "";
    return end ? `${n} × ${articleName(p.title)} ✓${where}. Lote completo: llévalo a empaque.` : `${n} × ${articleName(p.title)} ✓${where}`;
  });
}

/**
 * Nothing (or not enough) at a stop of a batch: each order's share is reported missing as in
 * markShort, which looks for the title elsewhere and adds the new stops to the same route.
 */
export async function markBatchShort(c: Ctx, d: { batchId: number; locationId: number; productId: number }) {
  const batch = await batchOf(c, d.batchId);
  const tasks = await stopTasks(c.db, batch.id, d.locationId, d.productId);
  if (tasks.length === 0) throw new UserError("PICK-04", "Esa parada ya está resuelta.");
  const missing = tasks.reduce((s, t) => s + t.task.quantity - t.task.picked, 0);
  const stillToPick = async () =>
    (
      await c.db
        .select({ n: sql<number>`coalesce(sum(${pickTasks.quantity} - ${pickTasks.picked}), 0)`.mapWith(Number) })
        .from(pickTasks)
        .innerJoin(orders, eq(orders.id, pickTasks.orderId))
        .where(and(eq(orders.batchId, batch.id), eq(pickTasks.status, "pending"), eq(pickTasks.productId, d.productId)))
    )[0].n;
  const before = (await stillToPick()) - missing;
  for (const { task } of tasks) await markShort(c, task.id);
  await checkBatchEnd(c.db, batch.id);
  // What markShort found on other shelves is what was added to the route for this title.
  const found = Math.min(missing, (await stillToPick()) - before);
  if (found === missing) return "Registrado. El artículo está en otra ubicación y se sumó al recorrido.";
  if (found > 0) return `Registrado. Hay una parte en otra ubicación; ${missing - found} quedan como faltante.`;
  return `Registrado: ${missing} quedan como faltante. Conviene contar esa ubicación.`;
}
