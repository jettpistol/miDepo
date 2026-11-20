import { and, eq, ne } from "drizzle-orm";
import { companies, orders } from "@/db/schema";
import { UserError } from "../errors";
import type { Ctx } from "./common";

export type ControlMode = "packing" | "all" | "large";

export const controlMode = (minUnits: number | null): ControlMode => (minUnits == null ? "packing" : minUnits <= 1 ? "all" : "large");

/**
 * Company settings for checking orders (Organización). Turning the Control step off sends the orders
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

/** For the whole company: how picking batches are split into orders. Open batches keep theirs. */
export async function saveBatchSorting(c: Ctx, sorting: string) {
  if (sorting !== "packing" && sorting !== "trays") throw new UserError("SET-03", "Elige cómo se separa el lote.");
  await c.db.update(companies).set({ batchSorting: sorting }).where(eq(companies.id, c.companyId));
  return sorting === "trays" ? "Guardado. Los lotes nuevos se separan por bandeja." : "Guardado. Los lotes nuevos se separan en empaque.";
}

/** Same rule as `npm run company:create`: what people type on the phone to log in with a PIN. */
export const VALID_CODE = /^[a-z0-9-]{2,20}$/;
export const MAX_NAME = 80;

/** Renames the organisation. Shown in the sidebar, the menu and the account switcher. */
export async function renameOrganization(c: Ctx, raw: string) {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new UserError("SET-04", "Escribe el nombre de la organización.");
  if (name.length > MAX_NAME) throw new UserError("SET-05", `El nombre tiene como máximo ${MAX_NAME} caracteres.`);
  await c.db.update(companies).set({ name }).where(eq(companies.id, c.companyId));
  return name;
}

/**
 * Changes the code typed to log in with a PIN. PINs are tied to the company id, not to the
 * code, so they keep working, and open sessions stay open.
 */
export async function changeOrganizationCode(c: Ctx, raw: string) {
  const slug = raw.trim().toLowerCase();
  if (!VALID_CODE.test(slug)) throw new UserError("SET-06", "El código va en minúsculas y sin espacios: de 2 a 20 letras, números o guiones.");
  const [taken] = await c.db.select({ id: companies.id }).from(companies).where(and(eq(companies.slug, slug), ne(companies.id, c.companyId)));
  if (taken) throw new UserError("SET-07", "Ese código ya lo usa otra organización. Elige otro.");
  await c.db.update(companies).set({ slug }).where(eq(companies.id, c.companyId));
  return slug;
}
