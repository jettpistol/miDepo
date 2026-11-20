import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { companies, customers, orderLines, orders, pickTasks } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, moveStock, zone } from "../stock";
import { validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

/**
 * Control: before packing, a second count of what was picked. Two ways, chosen in Ajustes:
 * - Without a Control step (controlMinUnits null), packing is the control: it scans every unit again.
 * - With it, orders with at least controlMinUnits picked units wait in Control (status to_control)
 *   until every picked unit has been scanned again.
 * A customer marked alwaysControl sends every order of theirs to Control, whatever the mode.
 * In both, samePersonChecks = false means whoever picked the order cannot do the check, unless a
 * supervisor allowed it for that one order (sameCheckAllowedBy).
 */

type CompanySettings = Pick<typeof companies.$inferSelect, "controlMinUnits" | "samePersonChecks">;

export async function settingsOf(tx: Executor, companyId: number): Promise<CompanySettings> {
  const [s] = await tx.select({ controlMinUnits: companies.controlMinUnits, samePersonChecks: companies.samePersonChecks }).from(companies).where(eq(companies.id, companyId));
  return s;
}

/** Whether an order that has just finished picking goes to Control. */
export const goesToControl = (s: CompanySettings, pickedUnits: number, customerAlways = false) =>
  pickedUnits > 0 && (customerAlways || (s.controlMinUnits != null && pickedUnits >= s.controlMinUnits));

/** Whether the Control screen is in use: the step is on, or some customer always goes through it. */
export async function controlInUse(tx: Executor, company: Pick<typeof companies.$inferSelect, "id" | "controlMinUnits">) {
  if (company.controlMinUnits != null) return true;
  const [one] = await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.companyId, company.id), eq(customers.alwaysControl, true))).limit(1);
  return Boolean(one);
}

/**
 * Whether this person may do the check on this order (Control, or packing when it is the check).
 * Returns the reason when not.
 */
export function blockedCheck(s: CompanySettings, order: { takenBy: number | null; sameCheckAllowedBy: number | null }, userId: number, what: "controlar" | "empacar") {
  if (s.samePersonChecks || order.takenBy !== userId || order.sameCheckAllowedBy != null) return null;
  return `Lo preparaste tú. Lo ${what === "controlar" ? "controla" : "empaca"} otra persona.`;
}

async function orderToControl(c: Ctx, id: number) {
  const [p] = await c.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.companyId, c.companyId)));
  if (!p) throw new UserError("CTRL-01", "No se encontró ese pedido.");
  if (p.status !== "to_control") throw new UserError("CTRL-02", "El pedido no está en Control.");
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
  if (!line || line.picked === 0) throw new UserError("CTRL-04", `"${articleName(p.title)}" no está en el pedido.`);
  const left = line.picked - line.checked;
  if (left === 0) throw new UserError("CTRL-05", `"${articleName(p.title)}": todo controlado.`);
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
  return "Control reiniciado.";
}

/**
 * Units recorded as picked that are not in the cart: they move from Pedidos preparados to
 * FALTANTES (still owned; a count may find them, a supervisor may write them off) and the order
 * goes out without them.
 */
export async function reportMissing(c: Ctx, orderId: number, lineId: number) {
  const order = await orderToControl(c, orderId);
  const [line] = await c.db.select().from(orderLines).where(and(eq(orderLines.id, lineId), eq(orderLines.orderId, orderId)));
  if (!line || line.checked >= line.picked) throw new UserError("CTRL-07", "No falta nada.");
  const missing = line.picked - line.checked;
  await c.db.transaction(async (tx) => {
    const [from, to] = [await zone(tx, c.companyId, "staging"), await zone(tx, c.companyId, "missing")];
    await moveStock(tx, { companyId: c.companyId, productId: line.productId, fromId: from.id, toId: to.id, quantity: missing, reason: "missing", reference: order.number, userId: c.userId });
    await tx.update(orderLines).set({ picked: line.checked }).where(eq(orderLines.id, line.id));
    // The route says what is in Preparación: take the units off its stops too, so undoing the picking later returns only what is there.
    let left = missing;
    for (const t of await tx.select().from(pickTasks).where(and(eq(pickTasks.lineId, line.id), gt(pickTasks.picked, 0))).orderBy(desc(pickTasks.id))) {
      if (left === 0) break;
      const off = Math.min(t.picked, left);
      await tx.update(pickTasks).set({ picked: t.picked - off }).where(eq(pickTasks.id, t.id));
      left -= off;
    }
  });
  return `${missing} a Faltantes.`;
}

export async function finishControl(c: Ctx, orderId: number) {
  const order = await orderToControl(c, orderId);
  const lines = await c.db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  const left = lines.reduce((s, l) => s + (l.picked - l.checked), 0);
  if (left > 0) throw new UserError("CTRL-08", `Quedan ${left} sin controlar.`);
  await c.db.update(orders).set({ status: "picked", controlledBy: c.userId }).where(and(eq(orders.id, orderId), eq(orders.status, "to_control")));
  return `Pedido ${order.number} controlado.`;
}

/**
 * A supervisor lets whoever picked this one order control it (or pack it, when packing is the
 * check), or takes that permission back. Only while the order still waits for its check.
 */
export async function allowSameCheck(c: Ctx, orderId: number, allow: boolean) {
  const [p] = await c.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.companyId, c.companyId)));
  if (!p) throw new UserError("CTRL-09", "No se encontró ese pedido.");
  if (allow && p.takenBy === c.userId) throw new UserError("CTRL-10", "Lo preparaste tú. Lo permite otro supervisor.");
  const changed = await c.db
    .update(orders)
    .set({ sameCheckAllowedBy: allow ? c.userId : null })
    .where(and(eq(orders.id, orderId), inArray(orders.status, ["in_picking", "to_control", "picked"])))
    .returning({ id: orders.id });
  if (changed.length === 0) throw new UserError("CTRL-11", `Pedido ${p.number} ya empacado.`);
  return allow ? "Permitido." : "Permiso quitado.";
}

/**
 * Marks a customer whose orders always go through Control, or takes the mark off. Taking it off
 * sends their orders waiting in Control to packing, unless the company's rule keeps them there.
 */
export async function setCustomerControl(c: Ctx, customerId: number, always: boolean) {
  const [cu] = await c.db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, c.companyId)));
  if (!cu) throw new UserError("CTRL-12", "No se encontró ese cliente.");
  return c.db.transaction(async (tx) => {
    await tx.update(customers).set({ alwaysControl: always }).where(eq(customers.id, customerId));
    if (always) return "Control obligatorio.";
    const s = await settingsOf(tx, c.companyId);
    const waiting = await tx
      .select({ id: orders.id, units: sql<number>`coalesce(sum(${orderLines.picked}), 0)`.mapWith(Number) })
      .from(orders)
      .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
      .where(and(eq(orders.customerId, customerId), eq(orders.status, "to_control")))
      .groupBy(orders.id);
    const release = waiting.filter((o) => !goesToControl(s, o.units)).map((o) => o.id);
    if (release.length > 0) await tx.update(orders).set({ status: "picked" }).where(and(inArray(orders.id, release), eq(orders.status, "to_control")));
    return release.length === 0 ? "Sin control obligatorio." : `Sin control obligatorio. ${release.length} a Empaque.`;
  });
}
