import { UserError } from "../errors";
import { findProduct, findLocation, moveStock } from "../stock";
import { validQuantity, type Ctx } from "./common";

/** Moves units from one location to another. Putting away received stock is the same movement from Receiving. */
export async function move(c: Ctx, d: { source: string; product: string; destination: string; quantity: unknown }) {
  const n = validQuantity(d.quantity);
  const source = await findLocation(c.db, c.companyId, d.source);
  const p = await findProduct(c.db, c.companyId, d.product);
  const destination = await findLocation(c.db, c.companyId, d.destination);
  if (source.type === "staging" || destination.type === "staging") {
    throw new UserError("STK-09", "Los pedidos preparados no se mueven a mano: salen cuando se despacha el pedido.");
  }
  if (destination.type === "missing") throw new UserError("STK-11", "Nada pasa a Faltantes a mano: pasa solo cuando un libro no está en el estante al preparar un pedido.");
  const putaway = source.type === "receiving" || source.type === "returns";
  // A book taken out of FALTANTES turned up: it was never written off, so it simply comes back.
  const reason = source.type === "missing" ? "found" : putaway ? "putaway" : "movement";
  await c.db.transaction((tx) =>
    moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: source.id, toId: destination.id, quantity: n, reason, userId: c.userId }),
  );
  return `${n} × ${p.title}: ${source.code} → ${destination.code}`;
}
