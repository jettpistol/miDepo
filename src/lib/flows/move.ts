import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DB } from "@/db";
import { locations, movements, products, stock } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, findLocation, moveStock } from "../stock";
import { validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

/** The rules every manual move follows, for one article or a whole location. */
function checkMove(source: { type: string; id: number }, destination: { type: string; id: number }) {
  if (source.type === "staging" || destination.type === "staging") {
    throw new UserError("STK-09", "Los pedidos preparados no se mueven manualmente: salen cuando se despacha el pedido.");
  }
  if (source.type === "outside" || destination.type === "outside") throw new UserError("STK-23", "Lo que sale del depósito o vuelve va por Salidas.");
  if (destination.type === "missing") throw new UserError("STK-11", "Nada pasa a Faltantes manualmente: solo ocurre cuando un artículo no está en su ubicación durante el picking.");
  const putaway = source.type === "receiving" || source.type === "returns";
  // A book taken out of FALTANTES turned up: it was never written off, so it simply comes back.
  return source.type === "missing" ? ("found" as const) : putaway ? ("putaway" as const) : ("movement" as const);
}

/** Moves units from one location to another. Putting away received stock is the same movement from Receiving. */
export async function move(c: Ctx, d: { source: string; product: string; destination: string; quantity: unknown }) {
  const n = validQuantity(d.quantity);
  const source = await findLocation(c.db, c.companyId, d.source);
  const p = await findProduct(c.db, c.companyId, d.product);
  const destination = await findLocation(c.db, c.companyId, d.destination);
  const reason = checkMove(source, destination);
  await c.db.transaction((tx) =>
    moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: source.id, toId: destination.id, quantity: n, reason, userId: c.userId }),
  );
  return `${n} × ${articleName(p.title)}: ${source.code} → ${destination.code}`;
}

/**
 * Moves everything a location holds to another one in a single step: emptying a shelf, or a
 * whole shelf moving down the aisle. The movements share a reference (`MT-` and the first one's
 * number) so the whole move is listed, and undone, as one.
 */
export async function moveAll(c: Ctx, d: { source: string; destination: string }) {
  const source = await findLocation(c.db, c.companyId, d.source);
  const destination = await findLocation(c.db, c.companyId, d.destination);
  const reason = checkMove(source, destination);
  return c.db.transaction(async (tx) => {
    const held = await tx.select({ productId: stock.productId, quantity: stock.quantity }).from(stock).where(and(eq(stock.locationId, source.id), gt(stock.quantity, 0)));
    if (held.length === 0) throw new UserError("STK-22", `${source.code} está vacía.`);
    const reference = `MT-${randomUUID().slice(0, 8).toUpperCase()}`;
    for (const h of held) await moveStock(tx, { companyId: c.companyId, productId: h.productId, fromId: source.id, toId: destination.id, quantity: h.quantity, reason, reference, userId: c.userId });
    const n = held.reduce((s, h) => s + h.quantity, 0);
    return `${source.code} → ${destination.code}: ${held.length === 1 ? "1 artículo" : `${held.length} artículos`}, ${n === 1 ? "1 unidad" : `${n} unidades`}.`;
  });
}

const UNDOABLE = ["movement", "putaway", "found"] as const;
const undoRef = (id: number) => `MOV-${id}`;

/** Puts a whole-location move back, every article at once. Only while all of it is still at the destination. */
export async function undoMoveAll(c: Ctx, reference: string) {
  if (!reference.startsWith("MT-")) throw new UserError("STK-12", "Ese movimiento no se puede deshacer desde aquí.");
  const ms = await c.db.select().from(movements).where(and(eq(movements.companyId, c.companyId), eq(movements.reference, reference), inArray(movements.reason, [...UNDOABLE])));
  if (ms.length === 0) throw new UserError("STK-12", "Ese movimiento no se puede deshacer desde aquí.");
  if (ms.some((m) => m.userId !== c.userId)) throw new UserError("STK-13", "Solo quien hizo el movimiento puede deshacerlo.");
  const done = await c.db.select({ ref: movements.reference }).from(movements).where(and(eq(movements.companyId, c.companyId), eq(movements.reason, "undo"), inArray(movements.reference, ms.map((m) => undoRef(m.id)))));
  const left = ms.filter((m) => !done.some((x) => x.ref === undoRef(m.id)));
  if (left.length === 0) throw new UserError("STK-14", "Ese movimiento ya se deshizo.");
  return c.db.transaction(async (tx) => {
    for (const m of left) {
      const [there] = await tx.select({ n: stock.quantity }).from(stock).where(and(eq(stock.productId, m.productId), eq(stock.locationId, m.toId!)));
      if ((there?.n ?? 0) < m.quantity) throw new UserError("STK-15", "Esas unidades ya no están todas en el destino. Muévelas a mano.");
      await moveStock(tx, { companyId: c.companyId, productId: m.productId, fromId: m.toId, toId: m.fromId, quantity: m.quantity, reason: "undo", reference: undoRef(m.id), userId: c.userId });
    }
    const n = left.reduce((s, m) => s + m.quantity, 0);
    return `Deshecho: ${n === 1 ? "1 unidad volvió" : `${n} unidades volvieron`} a su origen.`;
  });
}

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

export type RecentMove = { id: number; reference: string | null; date: Date; quantity: number; title: string; from: string; to: string; articles: number; undone: boolean };

/**
 * This person's latest manual moves, with whether each can still be undone. A whole-location move
 * is one entry (`articles` > 1 or a `MT-` reference) however many articles it carried.
 */
export async function recentMoves(db: DB, companyId: number, userId: number, limit = 8): Promise<RecentMove[]> {
  const from = alias(locations, "from_location");
  const to = alias(locations, "to_location");
  const rows = await db
    .select({ id: movements.id, reference: movements.reference, date: movements.createdAt, quantity: movements.quantity, title: products.title, from: from.code, to: to.code })
    .from(movements)
    .innerJoin(products, eq(products.id, movements.productId))
    .innerJoin(from, eq(from.id, movements.fromId))
    .innerJoin(to, eq(to.id, movements.toId))
    .where(and(eq(movements.companyId, companyId), eq(movements.userId, userId), inArray(movements.reason, [...UNDOABLE])))
    .orderBy(desc(movements.id))
    .limit(limit * 40);
  if (rows.length === 0) return [];
  const undone = new Set(
    (await db.select({ ref: movements.reference }).from(movements).where(and(eq(movements.companyId, companyId), eq(movements.reason, "undo"), inArray(movements.reference, rows.map((r) => undoRef(r.id)))))).map((r) => r.ref),
  );
  const out: RecentMove[] = [];
  for (const r of rows) {
    const isUndone = undone.has(undoRef(r.id));
    const group = r.reference?.startsWith("MT-") ? out.find((o) => o.reference === r.reference) : undefined;
    if (group) {
      group.quantity += r.quantity;
      group.articles++;
      group.undone &&= isUndone;
      continue;
    }
    if (out.length === limit) break;
    out.push({ ...r, articles: 1, undone: isUndone });
  }
  return out;
}
