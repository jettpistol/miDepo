import { and, eq, notInArray } from "drizzle-orm";
import { companies, customers, orders } from "@/db/schema";
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
    if (!Number.isInteger(n) || n < 2 || n > 100000) throw new UserError("SET-01", "Unidades: número entero desde 2.");
    minUnits = n;
  } else throw new UserError("SET-02", "Elige el paso de control.");

  return c.db.transaction(async (tx) => {
    await tx.update(companies).set({ controlMinUnits: minUnits, samePersonChecks: d.samePerson }).where(eq(companies.id, c.companyId));
    // Orders of customers that always go through Control stay there.
    const keep = tx.select({ id: customers.id }).from(customers).where(and(eq(customers.companyId, c.companyId), eq(customers.alwaysControl, true)));
    const released = minUnits == null ? await tx.update(orders).set({ status: "picked" }).where(and(eq(orders.companyId, c.companyId), eq(orders.status, "to_control"), notInArray(orders.customerId, keep))).returning({ id: orders.id }) : [];
    return released.length > 0 ? `Guardado. ${released.length} a Empaque.` : "Guardado.";
  });
}
