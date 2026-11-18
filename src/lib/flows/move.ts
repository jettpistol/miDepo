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
  const putaway = source.type === "receiving" || source.type === "returns";
  await c.db.transaction((tx) =>
    moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: source.id, toId: destination.id, quantity: n, reason: putaway ? "putaway" : "movement", userId: c.userId }),
  );
  return `${n} × ${p.title}: ${source.code} → ${destination.code}`;
}
