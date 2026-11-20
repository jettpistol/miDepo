import { and, eq, inArray } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { counts, locations, orders, receivings, returns, users } from "@/db/schema";
import { UserError } from "../errors";
import type { Ctx } from "./common";

/** What a supervisor can give to a person. "putaway" is a zone (RECEPCION or DEVOLUCIONES): its put-away. */
export type AssignKind = "order" | "receiving" | "return" | "count" | "putaway";
export const ASSIGN_KINDS: AssignKind[] = ["order", "receiving", "return", "count", "putaway"];

/** Finds the thing to assign: its name for the message, and whether there is still work in it. */
async function target(c: Ctx, kind: AssignKind, id: number) {
  const mine = (t: { companyId: AnyPgColumn; id: AnyPgColumn }) => and(eq(t.id, id), eq(t.companyId, c.companyId));
  // Each kind saves to its own table; a union of tables does not type-check in one update.
  const save = {
    order: (u: number | null) => c.db.update(orders).set({ assignedTo: u }).where(eq(orders.id, id)),
    receiving: (u: number | null) => c.db.update(receivings).set({ assignedTo: u }).where(eq(receivings.id, id)),
    return: (u: number | null) => c.db.update(returns).set({ assignedTo: u }).where(eq(returns.id, id)),
    count: (u: number | null) => c.db.update(counts).set({ assignedTo: u }).where(eq(counts.id, id)),
    putaway: (u: number | null) => c.db.update(locations).set({ assignedTo: u }).where(eq(locations.id, id)),
  }[kind];
  switch (kind) {
    case "order": {
      const [o] = await c.db.select().from(orders).where(mine(orders));
      return o && { save, label: `${o.number}`, open: ["pending", "in_picking", "to_control", "picked"].includes(o.status) };
    }
    case "receiving": {
      const [r] = await c.db.select().from(receivings).where(mine(receivings));
      return r && { save, label: `${r.number}`, open: r.status !== "closed" };
    }
    case "return": {
      const [d] = await c.db.select().from(returns).where(mine(returns));
      return d && { save, label: `${d.number}`, open: d.status === "in_progress" };
    }
    case "count": {
      const [k] = await c.db.select().from(counts).where(mine(counts));
      return k && { save, label: `Conteo ${k.name}`, open: k.status === "open" };
    }
    case "putaway": {
      const [z] = await c.db.select().from(locations).where(and(mine(locations), inArray(locations.type, ["receiving", "returns"])));
      return z && { save, label: z.type === "receiving" ? "Reposición desde Recepción" : "Reposición desde Devoluciones", open: true };
    }
  }
}

/**
 * Gives a piece of work to a person, or takes it back (userId null). It says whose it is; it does
 * not lock it: anyone can still work on it, as on the floor work moves between people.
 */
export async function assign(c: Ctx, kind: string, id: number, userId: number | null) {
  if (!ASSIGN_KINDS.includes(kind as AssignKind)) throw new UserError("ASG-01", "Tipo de tarea desconocido.");
  const t = Number.isInteger(id) ? await target(c, kind as AssignKind, id) : undefined;
  if (!t) throw new UserError("ASG-02", "No se encontró.");
  if (!t.open) throw new UserError("ASG-03", `${t.label} sin trabajo pendiente.`);
  let name: string | null = null;
  if (userId != null) {
    const [u] = Number.isInteger(userId) ? await c.db.select({ name: users.name }).from(users).where(and(eq(users.id, userId), eq(users.companyId, c.companyId), eq(users.active, true))) : [];
    if (!u) throw new UserError("ASG-04", "Elige una persona de la lista.");
    name = u.name;
  }
  await t.save(userId);
  return name ? `Asignado a ${name}.` : "Sin asignar.";
}
