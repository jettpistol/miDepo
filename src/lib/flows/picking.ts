import { and, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { orderLines, orders, stock, pickTasks, locations } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, findLocation, moveStock, zone } from "../stock";
import { validQuantity, type Ctx } from "./common";

async function orderOf(c: Ctx, id: number) {
  const [p] = await c.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.companyId, c.companyId)));
  if (!p) throw new UserError("No encuentro ese pedido.");
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
    if (taken.length === 0) throw new UserError("Ese pedido ya lo tomó otra persona.");
    const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, orderId));
    const freeOnes = await available(tx, c.companyId, lines.map((l) => l.productId));
    const tasks: (typeof pickTasks.$inferInsert)[] = [];
    for (const l of lines) {
      const { stops, missing } = distribute(freeOnes.get(l.productId) ?? [], l.quantity);
      for (const s of stops) tasks.push({ orderId, lineId: l.id, productId: l.productId, locationId: s.locationId, quantity: s.quantity });
      if (missing > 0) tasks.push({ orderId, lineId: l.id, productId: l.productId, locationId: null, quantity: missing, status: "short" });
    }
    await tx.insert(pickTasks).values(tasks);
    await checkEnd(tx, orderId);
    return `Pedido ${p.number} tomado.`;
  });
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
  if (!t) throw new UserError("No encuentro esa parada del recorrido.");
  if (t.task.status !== "pending") throw new UserError("Esa parada ya está resuelta.");
  return t;
}

/** Confirms a stop: checks that the location and the title scanned are the ones asked for. */
export async function confirmPick(c: Ctx, d: { taskId: number; location: string; product: string; quantity: unknown }) {
  const n = validQuantity(d.quantity);
  const { task, order } = await taskOf(c, d.taskId);
  const u = await findLocation(c.db, c.companyId, d.location);
  if (u.id !== task.locationId) throw new UserError(`Estás en ${u.code}, pero esta parada es en otra ubicación. Fijate el cartel.`);
  const p = await findProduct(c.db, c.companyId, d.product);
  if (p.id !== task.productId) throw new UserError(`Ese es "${p.title}". No es el título que pide esta parada.`);
  const remaining = task.quantity - task.picked;
  if (n > remaining) throw new UserError(`Esta parada pide ${remaining}. Si tomaste de más, devolvé ${n - remaining} al estante.`);

  return c.db.transaction(async (tx) => {
    const prep = await zone(tx, c.companyId, "staging");
    await moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: u.id, toId: prep.id, quantity: n, reason: "picking", reference: order.number, userId: c.userId });
    await tx.update(pickTasks).set({ picked: task.picked + n, status: n === remaining ? "done" : "pending" }).where(eq(pickTasks.id, task.id));
    await tx.update(orderLines).set({ picked: sql`${orderLines.picked} + ${n}` }).where(eq(orderLines.id, task.lineId));
    const end = await checkEnd(tx, order.id);
    return end ? `Pedido ${order.number} completo. Llevalo a empaque.` : `${n} × ${p.title} ✓`;
  });
}

/**
 * The operator reports that what is missing is not at the location. miDepo looks for the title
 * elsewhere; if there is none, the stop is left as a shortage and the order carries on.
 */
export async function markShort(c: Ctx, taskId: number) {
  const { task, order } = await taskOf(c, taskId);
  const missing = task.quantity - task.picked;
  return c.db.transaction(async (tx) => {
    await tx.update(pickTasks).set({ status: "short" }).where(eq(pickTasks.id, task.id));
    // The operator is not sent back to a place where they already reported this title was missing.
    const alreadyFailed = await tx.select({ u: pickTasks.locationId }).from(pickTasks).where(and(eq(pickTasks.lineId, task.lineId), eq(pickTasks.status, "short")));
    const freeOnes = await available(tx, c.companyId, [task.productId], new Set(alreadyFailed.map((f) => f.u)));
    const { stops, missing: uncovered } = distribute(freeOnes.get(task.productId) ?? [], missing);
    if (stops.length > 0) {
      await tx.insert(pickTasks).values(stops.map((s) => ({ orderId: order.id, lineId: task.lineId, productId: task.productId, locationId: s.locationId, quantity: s.quantity })));
    }
    await checkEnd(tx, order.id);
    if (stops.length > 0 && uncovered === 0) return "Anotado. Encontré el título en otra ubicación y lo sumé al recorrido.";
    if (stops.length > 0) return `Anotado. Hay una parte en otra ubicación; ${uncovered} quedan como faltante.`;
    return `Anotado: ${missing} quedan como faltante. Conviene contar esa ubicación.`;
  });
}

