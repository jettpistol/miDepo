import { and, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { boxes, orderLines, orders, stock, pickTasks, locations, users } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, findLocation, moveStock, zone } from "../stock";
import { validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";
import { goesToControl, settingsOf } from "./control";

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

/** The operator takes a pending order: the route through the shelves is built. */
export async function takeOrder(c: Ctx, orderId: number) {
  const p = await orderOf(c, orderId);
  if (p.status === "cancelled") throw new UserError("PICK-19", `El pedido ${p.number} ya no figura como pendiente en Fierro.`);
  if (p.unknownLines > 0) throw new UserError("PICK-20", `El pedido ${p.number} tiene ${p.unknownLines === 1 ? "un artículo que no está" : `${p.unknownLines} artículos que no están`} en el catálogo. Sincroniza con Fierro cuando estén cargados.`);
  if (p.status === "pending" && p.fierroChange) throw new UserError("PICK-21", `Fierro cambió el pedido ${p.number}. Sincroniza antes de prepararlo.`);
  return c.db.transaction(async (tx) => {
    // The status change goes first and is conditional: if two people act at once, only one wins.
    const taken = await tx.update(orders).set({ status: "in_picking", takenBy: c.userId }).where(and(eq(orders.id, orderId), eq(orders.status, "pending"))).returning({ id: orders.id });
    if (taken.length === 0) {
      // Already yours (an old screen, or a second tap): carry on with it.
      if (p.status === "in_picking" && p.takenBy === c.userId) return `Pedido ${p.number} tomado.`;
      throw new UserError("PICK-02", "Ese pedido ya lo tomó otra persona.");
    }
    await tx.insert(pickTasks).values(await planRoute(tx, c.companyId, orderId));
    await checkEnd(tx, orderId);
    return `Pedido ${p.number} tomado.`;
  });
}

/** When no stop is left, the order goes to Control or straight to packing, as the company set it. Returns where it went. */
async function checkEnd(tx: Executor, orderId: number): Promise<false | "to_control" | "picked"> {
  const [remains] = await tx.select({ id: pickTasks.id }).from(pickTasks).where(and(eq(pickTasks.orderId, orderId), eq(pickTasks.status, "pending"))).limit(1);
  if (remains) return false;
  const [o] = await tx.select({ companyId: orders.companyId, units: sql<number>`coalesce(sum(${orderLines.picked}), 0)`.mapWith(Number) }).from(orders).leftJoin(orderLines, eq(orderLines.orderId, orders.id)).where(eq(orders.id, orderId)).groupBy(orders.id);
  const next = goesToControl(await settingsOf(tx, o.companyId), o.units) ? "to_control" : "picked";
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
    const end = await checkEnd(tx, order.id);
    if (end) return `Pedido ${order.number} completo. Llévalo a ${end === "to_control" ? "control" : "empaque"}.`;
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
    const released = await tx.update(orders).set({ status: "pending", takenBy: null, controlledBy: null }).where(and(eq(orders.id, orderId), eq(orders.status, order.status))).returning({ id: orders.id });
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
    const parts = [`Pedido ${order.number} soltado: vuelve a Pendientes.`];
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
    await backToPicking(tx, order.id);
    return "Deshecho: la parada vuelve al recorrido.";
  });
}
