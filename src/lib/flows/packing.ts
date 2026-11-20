import { and, eq, max, sql } from "drizzle-orm";
import { boxItems, boxes, orderLines, orders, products } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct } from "../stock";
import { validQuantity, type Ctx } from "./common";

async function orderToPack(c: Ctx, id: number) {
  const [p] = await c.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.companyId, c.companyId)));
  if (!p) throw new UserError("PACK-01", "No se encontró ese pedido.");
  if (p.status === "pending" || p.status === "in_picking") throw new UserError("PACK-02", "Este pedido todavía no terminó el picking.");
  if (p.status !== "picked") throw new UserError("PACK-03", "Este pedido ya está empacado.");
  return p;
}

/** Adds units to the order's open box (opening one if there is none). */
export async function scanIntoBox(c: Ctx, orderId: number, code: string, quantity: unknown) {
  const n = validQuantity(quantity);
  const order = await orderToPack(c, orderId);
  const p = await findProduct(c.db, c.companyId, code);
  return c.db.transaction(async (tx) => {
    const [line] = await tx.select().from(orderLines).where(and(eq(orderLines.orderId, orderId), eq(orderLines.productId, p.id)));
    if (!line || line.picked === 0) throw new UserError("PACK-04", `"${p.title}" no está entre lo preparado para el pedido ${order.number}.`);
    const left = line.picked - line.packed;
    if (left === 0) throw new UserError("PACK-05", `Ya empacaste todas las unidades de "${p.title}".`);
    if (n > left) throw new UserError("PACK-06", `De "${p.title}" quedan ${left} por empacar, no ${n}.`);
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
    return `Caja ${box.number}: ${n} × ${p.title}`;
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
  await c.db.update(orders).set({ status: "packed" }).where(eq(orders.id, orderId));
  return `Pedido ${order.number} empacado en ${ofOrder.length} caja${ofOrder.length === 1 ? "" : "s"}. Ya se puede cargar en Fierro.`;
}
