import { and, eq, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { companies, orderLines, orders } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, moveStock, zone } from "../stock";
import { validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

/**
 * Control: before packing, a second count of what was picked. Two ways, chosen in Ajustes:
 * - Without a Control step (controlMinUnits null), packing is the control: it scans every unit again.
 * - With it, orders with at least controlMinUnits picked units wait in Control (status to_control)
 *   until every picked unit has been scanned again.
 * In both, samePersonChecks = false means whoever picked the order cannot do the check.
 */

type CompanySettings = Pick<typeof companies.$inferSelect, "controlMinUnits" | "samePersonChecks">;

export async function settingsOf(tx: Executor, companyId: number): Promise<CompanySettings> {
  const [s] = await tx.select({ controlMinUnits: companies.controlMinUnits, samePersonChecks: companies.samePersonChecks }).from(companies).where(eq(companies.id, companyId));
  return s;
}

/** Whether an order that has just finished picking goes to Control. */
export const goesToControl = (s: CompanySettings, pickedUnits: number) => s.controlMinUnits != null && pickedUnits > 0 && pickedUnits >= s.controlMinUnits;

/**
 * Whether this person may do the check on this order (Control, or packing when it is the check).
 * Returns the reason when not.
 */
export function blockedCheck(s: CompanySettings, order: { takenBy: number | null }, userId: number, what: "controlar" | "empacar") {
  if (s.samePersonChecks || order.takenBy !== userId) return null;
  return `Preparaste este pedido: lo tiene que ${what} otra persona.`;
}

async function orderToControl(c: Ctx, id: number) {
  const [p] = await c.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.companyId, c.companyId)));
  if (!p) throw new UserError("CTRL-01", "No se encontró ese pedido.");
  if (p.status !== "to_control") throw new UserError("CTRL-02", "Este pedido no está esperando control.");
  const blocked = blockedCheck(await settingsOf(c.db, c.companyId), p, c.userId, "controlar");
  if (blocked) throw new UserError("CTRL-03", blocked);
  return p;
}

/** Counts units found in the cart. Refuses what was not picked, or more than was picked. */
export async function checkUnit(c: Ctx, orderId: number, code: string, quantity: unknown) {
  const n = validQuantity(quantity);
  const order = await orderToControl(c, orderId);
  const p = await findProduct(c.db, c.companyId, code);
  const [line] = await c.db.select().from(orderLines).where(and(eq(orderLines.orderId, orderId), eq(orderLines.productId, p.id)));
  if (!line || line.picked === 0) throw new UserError("CTRL-04", `"${articleName(p.title)}" no está entre lo preparado para el pedido ${order.number}. Devuélvelo a su ubicación.`);
  const left = line.picked - line.checked;
  if (left === 0) throw new UserError("CTRL-05", `Ya están controladas todas las unidades de "${articleName(p.title)}". Las que sobran vuelven a su ubicación.`);
  if (n > left) throw new UserError("CTRL-06", `De "${articleName(p.title)}" quedan ${left} por controlar, no ${n}.`);
  // Conditional on the count read, so two scans at once cannot pass the picked figure.
  const done = await c.db
    .update(orderLines)
    .set({ checked: sql`${orderLines.checked} + ${n}` })
    .where(and(eq(orderLines.id, line.id), sql`${orderLines.checked} + ${n} <= ${orderLines.picked}`))
    .returning({ id: orderLines.id });
  if (done.length === 0) throw new UserError("CTRL-06", `De "${articleName(p.title)}" quedan ${left} por controlar, no ${n}.`);
  return `${n} × ${articleName(p.title)} ✓`;
}

/** Starts the count again (the cart got mixed up). */
export async function restartControl(c: Ctx, orderId: number) {
  const order = await orderToControl(c, orderId);
  await c.db.update(orderLines).set({ checked: 0 }).where(eq(orderLines.orderId, orderId));
  return `Control de ${order.number} reiniciado.`;
}

/**
 * Units recorded as picked that are not in the cart: they move from Pedidos preparados to
 * FALTANTES (still owned; a count may find them, a supervisor may write them off) and the order
 * goes out without them.
 */
export async function reportMissing(c: Ctx, orderId: number, lineId: number) {
  const order = await orderToControl(c, orderId);
  const [line] = await c.db.select().from(orderLines).where(and(eq(orderLines.id, lineId), eq(orderLines.orderId, orderId)));
  if (!line || line.checked >= line.picked) throw new UserError("CTRL-07", "En ese artículo no falta nada.");
  const missing = line.picked - line.checked;
  await c.db.transaction(async (tx) => {
    const [from, to] = [await zone(tx, c.companyId, "staging"), await zone(tx, c.companyId, "missing")];
    await moveStock(tx, { companyId: c.companyId, productId: line.productId, fromId: from.id, toId: to.id, quantity: missing, reason: "missing", reference: order.number, userId: c.userId });
    await tx.update(orderLines).set({ picked: line.checked }).where(eq(orderLines.id, line.id));
  });
  return `Anotado: ${missing === 1 ? "1 unidad queda" : `${missing} unidades quedan`} como faltante.`;
}

export async function finishControl(c: Ctx, orderId: number) {
  const order = await orderToControl(c, orderId);
  const lines = await c.db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  const left = lines.reduce((s, l) => s + (l.picked - l.checked), 0);
  if (left > 0) throw new UserError("CTRL-08", `Quedan ${left === 1 ? "1 unidad" : `${left} unidades`} sin controlar. Escanéalas o márcalas como faltantes.`);
  await c.db.update(orders).set({ status: "picked", controlledBy: c.userId }).where(and(eq(orders.id, orderId), eq(orders.status, "to_control")));
  return `Pedido ${order.number} controlado. Ya se puede empacar.`;
}
