import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { boxes, companies, customers, orderLines, orders, pickBatches, products, stock, pickTasks, locations, users } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, findLocation, moveStock, zone } from "../stock";
import { validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";
import { goesToControl, settingsOf } from "./control";
import { notifyShortage, resolve } from "../notifications";

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

/**
 * The stops taking the order would create, from the stock free right now. Taking uses it,
 * and the order's page shows it before anyone takes the order (nothing is reserved until then).
 */
export async function planRoute(tx: Executor, companyId: number, orderId: number) {
  const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  const freeOnes = await available(tx, companyId, lines.map((l) => l.productId));
  const tasks: (typeof pickTasks.$inferInsert & { locationId: number | null; quantity: number })[] = [];
  for (const l of lines) {
    const { stops, missing } = distribute(freeOnes.get(l.productId) ?? [], l.quantity);
    for (const s of stops) tasks.push({ orderId, lineId: l.id, productId: l.productId, locationId: s.locationId, quantity: s.quantity });
    if (missing > 0) tasks.push({ orderId, lineId: l.id, productId: l.productId, locationId: null, quantity: missing, status: "short" });
  }
  return tasks;
}

/**
 * Units of each pending order that would come out short if it were taken now, one order at a
 * time (orders do not compete with each other here). Same rule as planRoute, in two queries.
 */
export async function shortages(tx: Executor, companyId: number, orderIds: number[]) {
  const result = new Map<number, number>();
  if (orderIds.length === 0) return result;
  const lines = await tx.select().from(orderLines).where(inArray(orderLines.orderId, orderIds));
  const freeOnes = await available(tx, companyId, [...new Set(lines.map((l) => l.productId))]);
  for (const l of lines) {
    const { missing } = distribute(freeOnes.get(l.productId) ?? [], l.quantity);
    if (missing > 0) result.set(l.orderId, (result.get(l.orderId) ?? 0) + missing);
  }
  return result;
}

/** The operator takes a pending order: the route through the shelves is built. */
export async function takeOrder(c: Ctx, orderId: number) {
  const p = await orderOf(c, orderId);
  if (p.status === "cancelled") throw new UserError("PICK-19", `El pedido ${p.number} ya no figura como pendiente en Fierro.`);
  if (p.unknownLines > 0) throw new UserError("PICK-20", `El pedido ${p.number} tiene ${p.unknownLines === 1 ? "un artículo que no está" : `${p.unknownLines} artículos que no están`} en el catálogo. Sincroniza con Fierro cuando estén cargados.`);
  if (p.status === "pending" && p.fierroChange) throw new UserError("PICK-21", `Fierro cambió el pedido ${p.number}. Sincroniza antes de prepararlo.`);
  return c.db.transaction(async (tx) => {
    // The status change goes first and is conditional: if two people act at once, only one wins.
    const taken = await tx.update(orders).set({ status: "in_picking", takenBy: c.userId, takenAt: new Date() }).where(and(eq(orders.id, orderId), eq(orders.status, "pending"))).returning({ id: orders.id });
    if (taken.length === 0) {
      // Already yours (an old screen, or a second tap): carry on with it.
      if (p.status === "in_picking" && p.takenBy === c.userId) return `${p.number} tomado.`;
      throw new UserError("PICK-02", "Ese pedido ya lo tomó otra persona.");
    }
    await tx.insert(pickTasks).values(await planRoute(tx, c.companyId, orderId));
    await checkEnd(tx, orderId);
    return `${p.number} tomado.`;
  });
}

/**
 * The stops of an order: for each line, the shelves that have it free. Stops already promised to
 * other orders (including earlier orders of the same batch, in this transaction) are not counted.
 */
async function buildRoute(tx: Executor, companyId: number, orderId: number) {
  const tasks = await planRoute(tx, companyId, orderId);
  if (tasks.length > 0) await tx.insert(pickTasks).values(tasks);
  await checkEnd(tx, orderId);
}

/** When no stop is left, the order goes to Control or straight to packing, as the company set it. Returns where it went. */
async function checkEnd(tx: Executor, orderId: number): Promise<false | "to_control" | "picked"> {
  const [remains] = await tx.select({ id: pickTasks.id }).from(pickTasks).where(and(eq(pickTasks.orderId, orderId), eq(pickTasks.status, "pending"))).limit(1);
  if (remains) return false;
  const [o] = await tx
    .select({ companyId: orders.companyId, always: customers.alwaysControl, units: sql<number>`coalesce(sum(${orderLines.picked}), 0)`.mapWith(Number) })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(eq(orders.id, orderId))
    .groupBy(orders.id, customers.alwaysControl);
  const next = goesToControl(await settingsOf(tx, o.companyId), o.units, o.always) ? "to_control" : "picked";
  await tx.update(orders).set({ status: next }).where(and(eq(orders.id, orderId), eq(orders.status, "in_picking")));
  return next;
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
    // Picking again: a "no progress" notice about this order no longer holds.
    await resolve(tx, c.companyId, `stalled_picking:${order.id}:`, { prefix: true });
    const end = await checkEnd(tx, order.id);
    if (end) return `${order.number} completo. Llévalo a ${end === "to_control" ? "control" : "empaque"}.`;
    return `${n} × ${articleName(p.title)} ✓`;
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
    let gone = 0;
    if (task.locationId != null) {
      const [onShelf] = await tx.select({ n: stock.quantity }).from(stock).where(and(eq(stock.productId, task.productId), eq(stock.locationId, task.locationId)));
      gone = Math.min(onShelf?.n ?? 0, missing);
      if (gone > 0) {
        const missingZone = await zone(tx, c.companyId, "missing");
        await moveStock(tx, { companyId: c.companyId, productId: task.productId, fromId: task.locationId, toId: missingZone.id, quantity: gone, reason: "missing", reference: order.number, userId: c.userId });
        const [[where], [what]] = await Promise.all([
          tx.select({ code: locations.code }).from(locations).where(eq(locations.id, task.locationId)),
          tx.select({ title: products.title }).from(products).where(eq(products.id, task.productId)),
        ]);
        await notifyShortage(tx, c.companyId, c.userId, { order: order.number, quantity: gone, article: articleName(what.title), where: where.code, key: `shortage:task:${task.id}` });
      }
    }
    await tx.update(pickTasks).set({ status: "short", sentToMissing: gone }).where(eq(pickTasks.id, task.id));
    // The operator is not sent back to a place where they already reported this title was missing.
    const alreadyFailed = await tx.select({ u: pickTasks.locationId }).from(pickTasks).where(and(eq(pickTasks.lineId, task.lineId), eq(pickTasks.status, "short")));
    const freeOnes = await available(tx, c.companyId, [task.productId], new Set(alreadyFailed.map((f) => f.u)));
    const { stops, missing: uncovered } = distribute(freeOnes.get(task.productId) ?? [], missing);
    if (stops.length > 0) {
      await tx.insert(pickTasks).values(stops.map((s) => ({ orderId: order.id, lineId: task.lineId, productId: task.productId, locationId: s.locationId, quantity: s.quantity, replacesTaskId: task.id })));
    }
    await checkEnd(tx, order.id);
    if (stops.length > 0 && uncovered === 0) return "Registrado. Otra ubicación agregada al recorrido.";
    if (stops.length > 0) return `Registrado. Otra ubicación agregada al recorrido; ${uncovered} a Faltantes.`;
    return `Registrado. ${missing} a Faltantes.`;
  });
}


// ───────────── Going back ─────────────

/** What was picked changed: the order is being picked again, and any Control count starts over. */
async function backToPicking(tx: Executor, orderId: number) {
  const back = await tx.update(orders).set({ status: "in_picking", controlledBy: null }).where(and(eq(orders.id, orderId), inArray(orders.status, ["to_control", "picked"]))).returning({ id: orders.id });
  if (back.length > 0) await tx.update(orderLines).set({ checked: 0 }).where(eq(orderLines.orderId, orderId));
}

/** Picking can be changed until packing starts: after that, units are in boxes. Waiting in Control counts as before packing. */
function stillPicking(order: typeof orders.$inferSelect) {
  if (order.status !== "in_picking" && order.status !== "to_control" && order.status !== "picked") throw new UserError("PICK-08", `El pedido ${order.number} ya pasó por empaque. Su picking ya no se puede cambiar.`);
}

/**
 * Drops an order: whatever was picked goes back to the location it came from, the route is
 * deleted and the order returns to Pendientes for anyone to take. Reports of units not found
 * stay in FALTANTES (they are a fact about the shelf, not about the order); each can be undone
 * first with undoShort. Only whoever took it, or a supervisor, can drop it.
 */
export async function releaseOrder(c: Ctx, orderId: number, { anyone = false } = {}) {
  const order = await orderOf(c, orderId);
  if (order.status === "pending") throw new UserError("PICK-09", `Nadie está preparando el pedido ${order.number}.`);
  stillPicking(order);
  if (order.takenBy !== c.userId && !anyone) {
    const [who] = order.takenBy ? await c.db.select({ name: users.name }).from(users).where(eq(users.id, order.takenBy)) : [];
    throw new UserError("PICK-10", `Este pedido lo está preparando ${who?.name ?? "otra persona"}. Solo esa persona o un supervisor puede soltarlo.`);
  }
  const [box] = await c.db.select({ id: boxes.id }).from(boxes).where(eq(boxes.orderId, orderId)).limit(1);
  if (box) throw new UserError("PICK-11", "Ya hay cajas armadas para este pedido. Vacíalas en empaque antes de soltarlo.");
  return c.db.transaction(async (tx) => {
    const released = await tx.update(orders).set({ status: "pending", takenBy: null, controlledBy: null, sameCheckAllowedBy: null, batchId: null, tray: null }).where(and(eq(orders.id, orderId), eq(orders.status, order.status))).returning({ id: orders.id });
    if (released.length === 0) throw new UserError("PICK-12", "El pedido cambió mientras tanto. Recarga la página.");
    const tasks = await tx.select().from(pickTasks).where(eq(pickTasks.orderId, orderId));
    const prep = await zone(tx, c.companyId, "staging");
    let back = 0;
    for (const t of tasks) {
      if (t.picked > 0 && t.locationId != null) {
        await moveStock(tx, { companyId: c.companyId, productId: t.productId, fromId: prep.id, toId: t.locationId, quantity: t.picked, reason: "undo", reference: order.number, userId: c.userId });
        back += t.picked;
      }
    }
    const inMissing = tasks.reduce((s, t) => s + t.sentToMissing, 0);
    await tx.delete(pickTasks).where(eq(pickTasks.orderId, orderId));
    await tx.update(orderLines).set({ picked: 0, checked: 0 }).where(eq(orderLines.orderId, orderId));
    const parts = [`${order.number} soltado: vuelve a Pendientes.`];
    if (back > 0) parts.push(`Devuelve ${back === 1 ? "la unidad tomada" : `las ${back} unidades tomadas`} a su ubicación.`);
    if (inMissing > 0) parts.push(`${inMissing === 1 ? "La unidad no encontrada sigue" : `Las ${inMissing} unidades no encontradas siguen`} en Faltantes.`);
    return parts.join(" ");
  });
}

async function anyTaskOf(c: Ctx, taskId: number) {
  const [t] = await c.db.select({ task: pickTasks, order: orders }).from(pickTasks).innerJoin(orders, eq(orders.id, pickTasks.orderId)).where(and(eq(pickTasks.id, taskId), eq(orders.companyId, c.companyId)));
  if (!t) throw new UserError("PICK-03", "No se encontró esa parada del recorrido.");
  stillPicking(t.order);
  return t;
}

/** Undoes a stop's pick: its units go from Preparación back to the location, and the stop is pending again. */
export async function unpick(c: Ctx, taskId: number) {
  const { task, order } = await anyTaskOf(c, taskId);
  if (task.picked === 0 || task.locationId == null) throw new UserError("PICK-13", "En esta parada todavía no se tomó nada.");
  if (task.status === "short") throw new UserError("PICK-18", "Primero deshaz el aviso de que no estaba en la ubicación.");
  return c.db.transaction(async (tx) => {
    const [line] = await tx.select().from(orderLines).where(eq(orderLines.id, task.lineId));
    if (line.picked - task.picked < line.packed) throw new UserError("PICK-14", "Parte de esto ya está en una caja. Sácalo de la caja en empaque primero.");
    const prep = await zone(tx, c.companyId, "staging");
    const [loc] = await tx.select({ code: locations.code }).from(locations).where(eq(locations.id, task.locationId!));
    await moveStock(tx, { companyId: c.companyId, productId: task.productId, fromId: prep.id, toId: task.locationId, quantity: task.picked, reason: "undo", reference: order.number, userId: c.userId });
    await tx.update(pickTasks).set({ picked: 0, status: "pending" }).where(eq(pickTasks.id, task.id));
    await tx.update(orderLines).set({ picked: line.picked - task.picked }).where(eq(orderLines.id, line.id));
    await backToPicking(tx, order.id);
    return `Deshecho: ${task.picked} ${task.picked === 1 ? "unidad vuelve" : "unidades vuelven"} a ${loc?.code ?? "su ubicación"}. La parada queda pendiente.`;
  });
}

/**
 * Undoes "No está aquí": the units sent to FALTANTES go back to the shelf, the stops
 * miDepo added elsewhere are removed, and the stop is pending again.
 */
export async function undoShort(c: Ctx, taskId: number) {
  const { task, order } = await anyTaskOf(c, taskId);
  if (task.status !== "short" || task.locationId == null) throw new UserError("PICK-15", "Esa parada no está marcada como no encontrada.");
  return c.db.transaction(async (tx) => {
    const replacements = await tx.select().from(pickTasks).where(eq(pickTasks.replacesTaskId, task.id));
    if (replacements.some((r) => r.picked > 0 || r.status !== "pending")) throw new UserError("PICK-16", "Las paradas que la reemplazaron ya avanzaron. Deshaz esas primero.");
    if (task.sentToMissing > 0) {
      const missingZone = await zone(tx, c.companyId, "missing");
      const [held] = await tx.select({ n: stock.quantity }).from(stock).where(and(eq(stock.productId, task.productId), eq(stock.locationId, missingZone.id)));
      if ((held?.n ?? 0) < task.sentToMissing) throw new UserError("PICK-17", "Esas unidades ya no están en Faltantes: se encontraron o se dieron de baja.");
      await moveStock(tx, { companyId: c.companyId, productId: task.productId, fromId: missingZone.id, toId: task.locationId, quantity: task.sentToMissing, reason: "undo", reference: order.number, userId: c.userId });
    }
    if (replacements.length > 0) await tx.delete(pickTasks).where(inArray(pickTasks.id, replacements.map((r) => r.id)));
    await tx.update(pickTasks).set({ status: "pending", sentToMissing: 0 }).where(eq(pickTasks.id, task.id));
    await resolve(tx, c.companyId, `shortage:task:${task.id}`);
    await backToPicking(tx, order.id);
    return "Deshecho: la parada vuelve al recorrido.";
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
      .set({ status: "in_picking", takenBy: c.userId, takenAt: new Date(), batchId: batch.id })
      // Not the ones a single "Preparar" would refuse: changed in Fierro, or with titles not in the catalogue.
      .where(and(eq(orders.companyId, c.companyId), eq(orders.status, "pending"), isNull(orders.fierroChange), eq(orders.unknownLines, 0)))
      .returning({ id: orders.id, date: orders.date, urgent: orders.urgent });
    if (taken.length === 0) throw new UserError("PICK-22", "No hay pedidos pendientes para preparar.");
    taken.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.date.getTime() - b.date.getTime() || a.id - b.id);
    // Urgent first, then oldest: when stock is short, those orders get it (and the lower trays).
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
  if (!b) throw new UserError("PICK-23", "No se encontró ese lote.");
  return b;
}

/** The pending tasks of one stop of a batch (a shelf and a title), oldest order first. */
async function stopTasks(tx: Executor, batchId: number, locationId: number, productId: number) {
  return tx
    .select({ task: pickTasks, order: orders })
    .from(pickTasks)
    .innerJoin(orders, eq(orders.id, pickTasks.orderId))
    .where(and(eq(orders.batchId, batchId), eq(pickTasks.status, "pending"), eq(pickTasks.locationId, locationId), eq(pickTasks.productId, productId)))
    .orderBy(desc(orders.urgent), asc(orders.date), asc(orders.id), asc(pickTasks.id));
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
      await resolve(tx, c.companyId, `stalled_picking:${order.id}:`, { prefix: true });
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
  if (found === missing) return "Registrado. Otra ubicación agregada al recorrido.";
  if (found > 0) return `Registrado. Otra ubicación agregada al recorrido; ${missing - found} a Faltantes.`;
  return `Registrado. ${missing} a Faltantes.`;
}

/** Every task of one stop of a batch, whatever its state. */
async function allStopTasks(tx: Executor, batchId: number, locationId: number, productId: number) {
  return tx
    .select({ task: pickTasks, order: orders })
    .from(pickTasks)
    .innerJoin(orders, eq(orders.id, pickTasks.orderId))
    .where(and(eq(orders.batchId, batchId), eq(pickTasks.locationId, locationId), eq(pickTasks.productId, productId)));
}

const reopenBatch = (tx: Executor, batchId: number) => tx.update(pickBatches).set({ status: "open" }).where(eq(pickBatches.id, batchId));

/** Undoes what was picked at a stop of a batch: the units go back to the shelf, for every order. */
export async function unpickBatchStop(c: Ctx, d: { batchId: number; locationId: number; productId: number }) {
  const batch = await batchOf(c, d.batchId);
  const picked = (await allStopTasks(c.db, batch.id, d.locationId, d.productId)).filter((t) => t.task.picked > 0 && t.task.status !== "short");
  if (picked.length === 0) throw new UserError("PICK-13", "En esta parada todavía no se tomó nada.");
  let units = 0;
  for (const { task } of picked) {
    await unpick(c, task.id);
    units += task.picked;
  }
  await reopenBatch(c.db, batch.id);
  const [loc] = await c.db.select({ code: locations.code }).from(locations).where(eq(locations.id, d.locationId));
  return `Deshecho: ${units} ${units === 1 ? "unidad vuelve" : "unidades vuelven"} a ${loc?.code ?? "su ubicación"}. La parada queda pendiente.`;
}

/** Undoes "No está aquí" at a stop of a batch, for every order that had it. */
export async function undoBatchShort(c: Ctx, d: { batchId: number; locationId: number; productId: number }) {
  const batch = await batchOf(c, d.batchId);
  const shorts = (await allStopTasks(c.db, batch.id, d.locationId, d.productId)).filter((t) => t.task.status === "short");
  if (shorts.length === 0) throw new UserError("PICK-15", "Esa parada no está marcada como no encontrada.");
  for (const { task } of shorts) await undoShort(c, task.id);
  await reopenBatch(c.db, batch.id);
  return "Deshecho: la parada vuelve al recorrido.";
}

/**
 * Drops a whole batch: each of its orders is released as with "Soltar pedido" (picked units back
 * to their shelves, the order back to Pendientes). Only whoever took it, or a supervisor.
 */
export async function releaseBatch(c: Ctx, batchId: number, { anyone = false } = {}) {
  const batch = await batchOf(c, batchId);
  if (batch.takenBy !== c.userId && !anyone) {
    const [who] = await c.db.select({ name: users.name }).from(users).where(eq(users.id, batch.takenBy));
    throw new UserError("PICK-24", `Este lote lo está preparando ${who?.name ?? "otra persona"}. Solo esa persona o un supervisor puede soltarlo.`);
  }
  const open = await c.db.select().from(orders).where(and(eq(orders.batchId, batch.id), inArray(orders.status, ["in_picking", "to_control", "picked"])));
  const [box] = open.length > 0 ? await c.db.select({ id: boxes.id }).from(boxes).where(inArray(boxes.orderId, open.map((o) => o.id))).limit(1) : [];
  if (box) throw new UserError("PICK-11", "Ya hay cajas armadas para este pedido. Vacíalas en empaque antes de soltarlo.");
  const units = (await c.db.select({ n: sql<number>`coalesce(sum(${orderLines.picked}), 0)`.mapWith(Number) }).from(orderLines).innerJoin(orders, eq(orders.id, orderLines.orderId)).where(eq(orders.batchId, batch.id)))[0].n;
  for (const o of open) await releaseOrder(c, o.id, { anyone: true });
  await c.db.update(pickBatches).set({ status: "done" }).where(eq(pickBatches.id, batch.id));
  const parts = [`${batchNumber(batch.number)} soltado: ${open.length === 1 ? "1 pedido vuelve" : `${open.length} pedidos vuelven`} a Pendientes.`];
  if (units > 0) parts.push(`Devuelve ${units === 1 ? "la unidad tomada" : `las ${units} unidades tomadas`} a su ubicación.`);
  return parts.join(" ");
}
