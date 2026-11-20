import { and, eq, inArray } from "drizzle-orm";
import { orders } from "@/db/schema";
import { UserError } from "../errors";
import type { Ctx } from "./common";

/**
 * Marks an order to go first in Picking and Empaque, or takes the mark off. Only while there is
 * still work on it: once packed, the order waits for Fierro and urgency changes nothing.
 */
export async function setUrgent(c: Ctx, orderId: number, urgent: boolean) {
  const [o] = await c.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.companyId, c.companyId)));
  if (!o) throw new UserError("ORD-01", "No se encontró ese pedido.");
  const changed = await c.db
    .update(orders)
    .set({ urgent })
    .where(and(eq(orders.id, orderId), inArray(orders.status, ["pending", "in_picking", "to_control", "picked"])))
    .returning({ id: orders.id });
  if (changed.length === 0) throw new UserError("ORD-02", `El pedido ${o.number} ya está empacado: la urgencia no cambia nada.`);
  return urgent ? `${o.number}: urgente.` : `${o.number}: sin urgencia.`;
}
