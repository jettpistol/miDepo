import { and, eq, sql } from "drizzle-orm";
import { customers, returnLines, returns, stock, type BookCondition } from "@/db/schema";
import type { Executor } from "@/db";
import { UserError } from "../errors";
import { findProduct, moveStock, zone } from "../stock";
import { nextNumber, validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

export const BOOK_CONDITIONS: { id: BookCondition; name: string; help: string }[] = [
  { id: "sellable", name: "Vendible", help: "Como nuevo. Vuelve a su ubicación." },
  { id: "damaged", name: "Dañado", help: "Roto, mojado o muy marcado. No se vende." },
  { id: "clearance", name: "Saldo", help: "Con detalles menores. Se vende con descuento." },
];

export async function createReturn(c: Ctx, customerId: number) {
  const [cust] = await c.db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, c.companyId)));
  if (!cust) throw new UserError("RET-01", "Elige un cliente de la lista.");
  const number = await nextNumber(c.db, returns, returns.number, eq(returns.companyId, c.companyId), "DEV-", 4);
  const [d] = await c.db.insert(returns).values({ companyId: c.companyId, customerId, number }).returning();
  return d.id;
}

async function open(c: Ctx, id: number) {
  const [d] = await c.db.select().from(returns).where(and(eq(returns.id, id), eq(returns.companyId, c.companyId)));
  if (!d) throw new UserError("RET-02", "No se encontró esa devolución.");
  if (d.status === "closed") throw new UserError("RET-03", "Esta devolución ya está cerrada.");
  return d;
}

export async function scanReturn(c: Ctx, returnId: number, code: string, bookCondition: string, quantity: unknown) {
  const n = validQuantity(quantity);
  const status = BOOK_CONDITIONS.find((e) => e.id === bookCondition);
  if (!status) throw new UserError("RET-04", "Elige en qué estado está el artículo.");
  await open(c, returnId);
  const p = await findProduct(c.db, c.companyId, code);
  await c.db
    .insert(returnLines)
    .values({ returnId, productId: p.id, bookCondition: status.id, quantity: n })
    .onConflictDoUpdate({ target: [returnLines.returnId, returnLines.productId, returnLines.bookCondition], set: { quantity: sql`${returnLines.quantity} + ${n}` } });
  return `${n} × ${articleName(p.title)} → ${status.name}`;
}

export async function removeReturnLine(c: Ctx, returnId: number, productId: number, bookCondition: string) {
  await open(c, returnId);
  await c.db.delete(returnLines).where(and(eq(returnLines.returnId, returnId), eq(returnLines.productId, productId), eq(returnLines.bookCondition, bookCondition as BookCondition)));
  return "Línea quitada.";
}

const zones = async (tx: Executor, companyId: number) => ({ sellable: await zone(tx, companyId, "returns"), damaged: await zone(tx, companyId, "damaged"), clearance: await zone(tx, companyId, "clearance") });

/** Closes the return: each book enters stock in the zone its condition calls for. */
export async function closeReturn(c: Ctx, returnId: number) {
  const d = await open(c, returnId);
  return c.db.transaction(async (tx) => {
    const lines = await tx.select().from(returnLines).where(eq(returnLines.returnId, returnId));
    if (lines.length === 0) throw new UserError("RET-05", "La devolución no tiene artículos escaneados.");
    const destination = await zones(tx, c.companyId);
    for (const l of lines) {
      await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: null, toId: destination[l.bookCondition].id, quantity: l.quantity, reason: "return", reference: d.number, userId: c.userId });
    }
    await tx.update(returns).set({ status: "closed" }).where(eq(returns.id, returnId));
    const sellables = lines.filter((l) => l.bookCondition === "sellable").reduce((s, l) => s + l.quantity, 0);
    return `${d.number} cerrada. ${sellables} unidades vendibles por reponer.`;
  });
}

/** Deletes an open return and everything scanned into it. */
export async function cancelReturn(c: Ctx, returnId: number) {
  const d = await open(c, returnId);
  await c.db.delete(returns).where(eq(returns.id, returnId));
  return `${d.number} cancelada.`;
}

/**
 * Reopens a closed return that Fierro has not been told about: its units leave the return
 * zones again. Only while all of them are still where the return put them.
 */
export async function reopenReturn(c: Ctx, returnId: number) {
  const [d] = await c.db.select().from(returns).where(and(eq(returns.id, returnId), eq(returns.companyId, c.companyId)));
  if (!d) throw new UserError("RET-02", "No se encontró esa devolución.");
  if (d.status !== "closed") throw new UserError("RET-06", "Esta devolución todavía está abierta.");
  if (d.sentToFierro) throw new UserError("RET-07", "Esta devolución ya se cargó en Fierro. No se puede reabrir.");
  return c.db.transaction(async (tx) => {
    const destination = await zones(tx, c.companyId);
    for (const l of await tx.select().from(returnLines).where(eq(returnLines.returnId, returnId))) {
      const z = destination[l.bookCondition];
      const [there] = await tx.select({ n: stock.quantity }).from(stock).where(and(eq(stock.productId, l.productId), eq(stock.locationId, z.id)));
      if ((there?.n ?? 0) < l.quantity) throw new UserError("RET-08", `Parte de lo devuelto ya salió de ${z.code}. Devuélvelo ahí con Mover para poder reabrir.`);
      await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: z.id, toId: null, quantity: l.quantity, reason: "undo", reference: d.number, userId: c.userId });
    }
    await tx.update(returns).set({ status: "in_progress" }).where(eq(returns.id, returnId));
    return `${d.number} reabierta. Sus unidades salieron del stock hasta que se vuelva a cerrar.`;
  });
}
