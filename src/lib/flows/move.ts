import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DB } from "@/db";
import { locations, movements, products, stock } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, findLocation, moveStock } from "../stock";
import { validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

/** Moves units from one location to another. Putting away received stock is the same movement from Receiving. */
export async function move(c: Ctx, d: { source: string; product: string; destination: string; quantity: unknown }) {
  const n = validQuantity(d.quantity);
  const source = await findLocation(c.db, c.companyId, d.source);
  const p = await findProduct(c.db, c.companyId, d.product);
  const destination = await findLocation(c.db, c.companyId, d.destination);
  if (source.type === "staging" || destination.type === "staging") {
    throw new UserError("STK-09", "Los pedidos preparados no se mueven manualmente: salen cuando se despacha el pedido.");
  }
  if (destination.type === "missing") throw new UserError("STK-11", "Nada pasa a Faltantes manualmente: solo ocurre cuando un artículo no está en su ubicación durante el picking.");
  const putaway = source.type === "receiving" || source.type === "returns";
  // A book taken out of FALTANTES turned up: it was never written off, so it simply comes back.
  const reason = source.type === "missing" ? "found" : putaway ? "putaway" : "movement";
  await c.db.transaction((tx) =>
    moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: source.id, toId: destination.id, quantity: n, reason, userId: c.userId }),
  );
  return `${n} × ${articleName(p.title)}: ${source.code} → ${destination.code}`;
}

const UNDOABLE = ["movement", "putaway", "found"] as const;
const undoRef = (id: number) => `MOV-${id}`;

/** Puts a manual move back: the units return from the destination to the origin. Once only. */
export async function undoMove(c: Ctx, movementId: number) {
  const [m] = await c.db.select().from(movements).where(and(eq(movements.id, movementId), eq(movements.companyId, c.companyId)));
  if (!m || !(UNDOABLE as readonly string[]).includes(m.reason) || m.fromId == null || m.toId == null) throw new UserError("STK-12", "Ese movimiento no se puede deshacer desde aquí.");
  if (m.userId !== c.userId) throw new UserError("STK-13", "Solo quien hizo el movimiento puede deshacerlo.");
  const [done] = await c.db.select({ id: movements.id }).from(movements).where(and(eq(movements.companyId, c.companyId), eq(movements.reason, "undo"), eq(movements.reference, undoRef(m.id)))).limit(1);
  if (done) throw new UserError("STK-14", "Ese movimiento ya se deshizo.");
  const [p] = await c.db.select({ title: products.title }).from(products).where(eq(products.id, m.productId));
  const [there] = await c.db.select({ n: stock.quantity }).from(stock).where(and(eq(stock.productId, m.productId), eq(stock.locationId, m.toId)));
  if ((there?.n ?? 0) < m.quantity) throw new UserError("STK-15", "Esas unidades ya no están todas en el destino. Muévelas a mano.");
  await c.db.transaction((tx) => moveStock(tx, { companyId: c.companyId, productId: m.productId, fromId: m.toId, toId: m.fromId, quantity: m.quantity, reason: "undo", reference: undoRef(m.id), userId: c.userId }));
  return `Deshecho: ${m.quantity} × ${articleName(p?.title ?? "")} volvió a su origen.`;
}

/** This person's latest manual moves, with whether each can still be undone. */
export async function recentMoves(db: DB, companyId: number, userId: number, limit = 8) {
  const from = alias(locations, "from_location");
  const to = alias(locations, "to_location");
  const rows = await db
    .select({ id: movements.id, date: movements.createdAt, quantity: movements.quantity, title: products.title, from: from.code, to: to.code })
    .from(movements)
    .innerJoin(products, eq(products.id, movements.productId))
    .innerJoin(from, eq(from.id, movements.fromId))
    .innerJoin(to, eq(to.id, movements.toId))
    .where(and(eq(movements.companyId, companyId), eq(movements.userId, userId), inArray(movements.reason, [...UNDOABLE])))
    .orderBy(desc(movements.id))
    .limit(limit);
  if (rows.length === 0) return [];
  const undone = new Set(
    (await db.select({ ref: movements.reference }).from(movements).where(and(eq(movements.companyId, companyId), eq(movements.reason, "undo"), inArray(movements.reference, rows.map((r) => undoRef(r.id)))))).map((r) => r.ref),
  );
  return rows.map((r) => ({ ...r, undone: undone.has(undoRef(r.id)) }));
}
