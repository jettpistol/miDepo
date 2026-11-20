import { and, eq, max, sql } from "drizzle-orm";
import { boxItems, boxes, orderLines, orders, products } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct } from "../stock";
import { validQuantity, type Ctx } from "./common";
import { prepareBoxLabels } from "./labels";
import { articleName } from "@/lib/article";
import { blockedCheck, settingsOf } from "./control";

async function orderToPack(c: Ctx, id: number) {
  const [p] = await c.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.companyId, c.companyId)));
  if (!p) throw new UserError("PACK-01", "No se encontró ese pedido.");
  if (p.status === "pending" || p.status === "in_picking") throw new UserError("PACK-02", "Este pedido todavía no terminó el picking.");
  if (p.status === "to_control") throw new UserError("PACK-20", "Pendiente de control.");
  if (p.status !== "picked") throw new UserError("PACK-03", "Este pedido ya está empacado.");
  // When the order skipped Control, packing is the check.
  const blocked = p.controlledBy == null ? blockedCheck(await settingsOf(c.db, c.companyId), p, c.userId, "empacar") : null;
  if (blocked) throw new UserError("PACK-21", blocked);
  return p;
}

/** Adds units to the order's open box (opening one if there is none). */
export async function scanIntoBox(c: Ctx, orderId: number, code: string, quantity: unknown) {
  const n = validQuantity(quantity);
  const order = await orderToPack(c, orderId);
  const p = await findProduct(c.db, c.companyId, code);
  return c.db.transaction(async (tx) => {
    const [line] = await tx.select().from(orderLines).where(and(eq(orderLines.orderId, orderId), eq(orderLines.productId, p.id)));
    if (!line || line.picked === 0) throw new UserError("PACK-04", `"${articleName(p.title)}" no está entre lo preparado para el pedido ${order.number}.`);
    const left = line.picked - line.packed;
    if (left === 0) throw new UserError("PACK-05", `Ya están empacadas todas las unidades de "${articleName(p.title)}".`);
    if (n > left) throw new UserError("PACK-06", `De "${articleName(p.title)}" quedan ${left} por empacar, no ${n}.`);
    let [box] = await tx.select().from(boxes).where(and(eq(boxes.orderId, orderId), eq(boxes.status, "open")));
    if (!box) {
      const [{ last }] = await tx.select({ last: max(boxes.number) }).from(boxes).where(eq(boxes.orderId, orderId));
      [box] = await tx.insert(boxes).values({ companyId: c.companyId, orderId, number: (last ?? 0) + 1 }).returning();
    }
    await tx
      .insert(boxItems)
      .values({ boxId: box.id, productId: p.id, quantity: n })
      .onConflictDoUpdate({ target: [boxItems.boxId, boxItems.productId], set: { quantity: sql`${boxItems.quantity} + ${n}` } });
    await tx.update(orderLines).set({ packed: line.packed + n }).where(eq(orderLines.id, line.id));
    return `Caja ${box.number}: ${n} × ${articleName(p.title)}`;
  });
}

export async function closeBox(c: Ctx, boxId: number, weightGrams?: unknown) {
  const [box] = await c.db.select().from(boxes).where(and(eq(boxes.id, boxId), eq(boxes.companyId, c.companyId)));
  if (!box || box.status !== "open") throw new UserError("PACK-07", "Esa caja no está abierta.");
  const items = await c.db
    .select({ quantity: boxItems.quantity, weight: products.weightGrams })
    .from(boxItems)
    .innerJoin(products, eq(products.id, boxItems.productId))
    .where(eq(boxItems.boxId, boxId));
  if (items.length === 0) throw new UserError("PACK-08", "La caja está vacía.");
  const estimated = items.reduce((s, i) => s + i.quantity * i.weight, 0);
  const real = Number(weightGrams);
  await c.db.update(boxes).set({ status: "closed", weightGrams: Number.isFinite(real) && real > 0 ? Math.round(real) : estimated }).where(eq(boxes.id, boxId));
  return `Caja ${box.number} cerrada.`;
}

/** Undoes an open box (in case it was loaded wrongly): its contents go back to "to pack". */
export async function emptyBox(c: Ctx, boxId: number) {
  const [box] = await c.db.select().from(boxes).where(and(eq(boxes.id, boxId), eq(boxes.companyId, c.companyId)));
  if (!box || box.status !== "open") throw new UserError("PACK-09", "Solo se puede vaciar una caja abierta.");
  await c.db.transaction(async (tx) => {
    const items = await tx.select().from(boxItems).where(eq(boxItems.boxId, boxId));
    for (const i of items) {
      await tx.update(orderLines).set({ packed: sql`${orderLines.packed} - ${i.quantity}` }).where(and(eq(orderLines.orderId, box.orderId), eq(orderLines.productId, i.productId)));
    }
    await tx.delete(boxes).where(eq(boxes.id, boxId));
  });
  return `Caja ${box.number} vaciada.`;
}

export async function finishPacking(c: Ctx, orderId: number) {
  const order = await orderToPack(c, orderId);
  const lines = await c.db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  const unpacked = lines.reduce((s, l) => s + (l.picked - l.packed), 0);
  if (unpacked > 0) throw new UserError("PACK-10", `Quedan ${unpacked} unidades preparadas sin empacar.`);
  const ofOrder = await c.db.select().from(boxes).where(eq(boxes.orderId, orderId));
  if (ofOrder.some((k) => k.status === "open")) throw new UserError("PACK-11", "Cierra la caja abierta antes de terminar.");
  if (ofOrder.length === 0 && lines.some((l) => l.picked > 0)) throw new UserError("PACK-12", "Todavía no hay ninguna caja.");
  await c.db.update(orders).set({ status: "packed", packedBy: c.userId }).where(eq(orders.id, orderId));
  if (ofOrder.length > 0) await prepareBoxLabels(c.db, c, orderId, order.number, ofOrder.length);
  return `${order.number} empacado en ${ofOrder.length} caja${ofOrder.length === 1 ? "" : "s"}.`;
}

async function openBoxOf(c: Ctx, boxId: number) {
  const [box] = await c.db.select().from(boxes).where(and(eq(boxes.id, boxId), eq(boxes.companyId, c.companyId)));
  if (!box) throw new UserError("PACK-13", "No se encontró esa caja.");
  await orderToPack(c, box.orderId);
  return box;
}

/** Takes one title out of an open box: its units go back to "to pack". */
export async function removeFromBox(c: Ctx, boxId: number, productId: number) {
  const box = await openBoxOf(c, boxId);
  if (box.status !== "open") throw new UserError("PACK-14", "Esa caja está cerrada. Reábrela para sacar algo.");
  return c.db.transaction(async (tx) => {
    const [item] = await tx.delete(boxItems).where(and(eq(boxItems.boxId, boxId), eq(boxItems.productId, productId))).returning();
    if (!item) throw new UserError("PACK-15", "Ese artículo no está en la caja.");
    await tx.update(orderLines).set({ packed: sql`${orderLines.packed} - ${item.quantity}` }).where(and(eq(orderLines.orderId, box.orderId), eq(orderLines.productId, productId)));
    return `Sacado de la caja ${box.number}: ${item.quantity} ${item.quantity === 1 ? "unidad vuelve" : "unidades vuelven"} a por empacar.`;
  });
}

/** Reopens a closed box while the order is still being packed. Only one box is open at a time. */
export async function reopenBox(c: Ctx, boxId: number) {
  const box = await openBoxOf(c, boxId);
  if (box.status === "open") throw new UserError("PACK-16", "Esa caja ya está abierta.");
  const [other] = await c.db.select({ number: boxes.number }).from(boxes).where(and(eq(boxes.orderId, box.orderId), eq(boxes.status, "open")));
  if (other) throw new UserError("PACK-17", `La caja ${other.number} está abierta. Ciérrala antes de reabrir otra.`);
  await c.db.update(boxes).set({ status: "open", weightGrams: null }).where(eq(boxes.id, boxId));
  return `Caja ${box.number} reabierta.`;
}

/** Undoes "Terminar empaque" while the order has not been loaded in Fierro (it has not left). */
export async function reopenPacking(c: Ctx, orderId: number) {
  const [p] = await c.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.companyId, c.companyId)));
  if (!p) throw new UserError("PACK-01", "No se encontró ese pedido.");
  if (p.status === "shipped") throw new UserError("PACK-18", "Este pedido ya se cargó en Fierro y salió del depósito. No se puede reabrir.");
  if (p.status !== "packed") throw new UserError("PACK-19", "Este pedido todavía no se terminó de empacar.");
  const reopened = await c.db.update(orders).set({ status: "picked" }).where(and(eq(orders.id, orderId), eq(orders.status, "packed"))).returning({ id: orders.id });
  if (reopened.length === 0) throw new UserError("PACK-18", "Este pedido ya se cargó en Fierro y salió del depósito. No se puede reabrir.");
  return `${p.number} reabierto en empaque.`;
}
