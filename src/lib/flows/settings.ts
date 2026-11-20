import { and, eq } from "drizzle-orm";
import { companies, orders } from "@/db/schema";
import { UserError } from "../errors";
import type { Ctx } from "./common";

export type ControlMode = "packing" | "all" | "large";

export const controlMode = (minUnits: number | null): ControlMode => (minUnits == null ? "packing" : minUnits <= 1 ? "all" : "large");

/**
 * Company settings for checking orders (Ajustes). Turning the Control step off sends the orders
 * waiting there to packing, which scans every unit anyway; turning it on applies to orders that
 * finish picking from now on.
 */
export async function saveControlSettings(c: Ctx, d: { mode: string; minUnits?: unknown; samePerson: boolean }) {
  let minUnits: number | null;
  if (d.mode === "packing") minUnits = null;
  else if (d.mode === "all") minUnits = 1;
  else if (d.mode === "large") {
    const n = Number(d.minUnits);
    if (!Number.isInteger(n) || n < 2 || n > 100000) throw new UserError("SET-01", "Para pedidos grandes, escribe desde cuántas unidades: un número entero de 2 o más.");
    minUnits = n;
  } else throw new UserError("SET-02", "Elige cómo se controlan los pedidos.");

  return c.db.transaction(async (tx) => {
    await tx.update(companies).set({ controlMinUnits: minUnits, samePersonChecks: d.samePerson }).where(eq(companies.id, c.companyId));
    const released = minUnits == null ? await tx.update(orders).set({ status: "picked" }).where(and(eq(orders.companyId, c.companyId), eq(orders.status, "to_control"))).returning({ id: orders.id }) : [];
    return released.length > 0 ? `Guardado. ${released.length === 1 ? "1 pedido que esperaba control pasó" : `${released.length} pedidos que esperaban control pasaron`} a empaque.` : "Guardado.";
  });
}
