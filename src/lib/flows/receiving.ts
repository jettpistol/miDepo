import { and, count, eq, sql } from "drizzle-orm";
import { receivingLines, receivings } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, moveStock, zone } from "../stock";
import { validQuantity, type Ctx } from "./common";

async function open(c: Ctx, id: number) {
  const [r] = await c.db.select().from(receivings).where(and(eq(receivings.id, id), eq(receivings.companyId, c.companyId)));
  if (!r) throw new UserError("No encuentro esa recepción.");
  if (r.status === "closed") throw new UserError("Esta recepción ya está cerrada.");
  return r;
}

export async function createUnannouncedReceiving(c: Ctx, supplier: string) {
  const name = supplier.trim();
  if (!name) throw new UserError("Escribí de dónde viene la mercadería (imprenta, proveedor, feria…).");
  const [{ n }] = await c.db.select({ n: count() }).from(receivings).where(and(eq(receivings.companyId, c.companyId), sql`${receivings.fierroId} is null`));
  const [r] = await c.db
    .insert(receivings)
    .values({ companyId: c.companyId, number: `REC-${String(n + 1).padStart(4, "0")}`, supplier: name, status: "in_progress" })
    .returning();
  return r.id;
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
  const notice = line.expected === 0 ? " (no estaba en el aviso)" : line.received > line.expected ? ` (¡van ${line.received - line.expected} de más!)` : "";
  return `${p.title}: ${line.received} de ${line.expected}${notice}`;
}

export async function setReceived(c: Ctx, receivingId: number, productId: number, received: unknown) {
  const n = Number(received);
  if (!Number.isInteger(n) || n < 0) throw new UserError("Escribí un número de cero para arriba.");
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
    if (total === 0) throw new UserError("Todavía no escaneaste nada en esta recepción.");
    const destination = await zone(tx, c.companyId, "receiving");
    for (const l of lines) {
      if (l.received > 0) {
        await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: null, toId: destination.id, quantity: l.received, reason: "receiving", reference: r.number, userId: c.userId });
      }
    }
    await tx.update(receivings).set({ status: "closed" }).where(eq(receivings.id, receivingId));
    return `Recepción ${r.number} cerrada: ${total} unidades esperan en Recepción para guardar.`;
  });
}
