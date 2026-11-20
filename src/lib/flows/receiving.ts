import { and, count, eq, sql } from "drizzle-orm";
import { receivingLines, receivings, suppliers } from "@/db/schema";
import { distance, plain } from "../text";
import { UserError } from "../errors";
import { findProduct, moveStock, zone } from "../stock";
import { validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

async function open(c: Ctx, id: number) {
  const [r] = await c.db.select().from(receivings).where(and(eq(receivings.id, id), eq(receivings.companyId, c.companyId)));
  if (!r) throw new UserError("RCV-01", "No se encontró esa recepción.");
  if (r.status === "closed") throw new UserError("RCV-02", "Esta recepción ya está cerrada.");
  return r;
}

/** A receiving that Fierro did not announce. The supplier has to be one already on the list. */
export async function createUnannouncedReceiving(c: Ctx, supplierId: number) {
  const [supplier] = Number.isInteger(supplierId) ? await c.db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.companyId, c.companyId))) : [];
  if (!supplier) throw new UserError("RCV-03", "Elige un proveedor de la lista.");
  const [{ n }] = await c.db.select({ n: count() }).from(receivings).where(and(eq(receivings.companyId, c.companyId), sql`${receivings.fierroId} is null`));
  const [r] = await c.db
    .insert(receivings)
    .values({ companyId: c.companyId, number: `REC-${String(n + 1).padStart(4, "0")}`, supplierId: supplier.id, status: "in_progress" })
    .returning();
  return r.id;
}

/**
 * Adds a supplier on purpose, from the "Crear proveedor" choice. Refuses names that already
 * exist, even with different accents, capitals or spacing, so the list does not fill with near-copies.
 */
export async function createSupplier(c: Ctx, name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 2) throw new UserError("RCV-04", "Escribe el nombre del proveedor.");
  if (clean.length > 80) throw new UserError("RCV-05", "El nombre es demasiado largo.");
  if (!/\p{L}/u.test(clean)) throw new UserError("RCV-06", "El nombre tiene que tener letras.");
  const existing = await c.db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.companyId, c.companyId));
  const same = existing.find((s) => plain(s.name) === plain(clean));
  if (same) throw new UserError("RCV-07", `Ya existe: ${same.name}. Elígelo de la lista.`);
  // One or two letters off an existing name is almost always a typo of it.
  const near = existing.find((s) => Math.min(plain(s.name).length, plain(clean).length) >= 6 && distance(plain(s.name), plain(clean)) <= 2);
  if (near) throw new UserError("RCV-08", `¿Es ${near.name}? Ya existe un proveedor casi igual. Elígelo de la lista.`);
  const [created] = await c.db.insert(suppliers).values({ companyId: c.companyId, name: clean, createdBy: c.userId }).returning({ id: suppliers.id, name: suppliers.name });
  return created;
}

/** Adds received units of a title. If the title was not on the notice, it is added anyway. */
export async function scanReceiving(c: Ctx, receivingId: number, code: string, quantity: unknown) {
  const n = validQuantity(quantity);
  const r = await open(c, receivingId);
  const p = await findProduct(c.db, c.companyId, code);
  const [line] = await c.db
    .insert(receivingLines)
    .values({ receivingId, productId: p.id, expected: 0, received: n })
    .onConflictDoUpdate({ target: [receivingLines.receivingId, receivingLines.productId], set: { received: sql`${receivingLines.received} + ${n}` } })
    .returning();
  if (r.status === "pending") await c.db.update(receivings).set({ status: "in_progress" }).where(eq(receivings.id, receivingId));
  const notice = line.expected === 0 ? " (no estaba en el aviso)" : line.received > line.expected ? ` (${line.received - line.expected} de más)` : "";
  return `${articleName(p.title)}: ${line.received} de ${line.expected}${notice}`;
}

export async function setReceived(c: Ctx, receivingId: number, productId: number, received: unknown) {
  const n = Number(received);
  if (!Number.isInteger(n) || n < 0) throw new UserError("RCV-09", "Escribe un número de cero para arriba.");
  await open(c, receivingId);
  await c.db.update(receivingLines).set({ received: n }).where(and(eq(receivingLines.receivingId, receivingId), eq(receivingLines.productId, productId)));
  return "Cantidad corregida.";
}

/** Closes the receiving: what was received enters stock in the Receiving zone, ready to put away. */
export async function closeReceiving(c: Ctx, receivingId: number) {
  const r = await open(c, receivingId);
  return c.db.transaction(async (tx) => {
    const lines = await tx.select().from(receivingLines).where(eq(receivingLines.receivingId, receivingId));
    const total = lines.reduce((s, l) => s + l.received, 0);
    if (total === 0) throw new UserError("RCV-10", "La recepción no tiene artículos escaneados.");
    const destination = await zone(tx, c.companyId, "receiving");
    for (const l of lines) {
      if (l.received > 0) {
        await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: null, toId: destination.id, quantity: l.received, reason: "receiving", reference: r.number, userId: c.userId });
      }
    }
    await tx.update(receivings).set({ status: "closed" }).where(eq(receivings.id, receivingId));
    return `Recepción ${r.number} cerrada. ${total} unidades por reponer.`;
  });
}
