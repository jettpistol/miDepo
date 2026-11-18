import { and, count, eq, sql } from "drizzle-orm";
import { customers, returnLines, returns, type BookCondition } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, moveStock, zone } from "../stock";
import { validQuantity, type Ctx } from "./common";

export const BOOK_CONDITIONS: { id: BookCondition; name: string; help: string }[] = [
  { id: "sellable", name: "Vendible", help: "Como nuevo. Vuelve a la estantería." },
  { id: "damaged", name: "Dañado", help: "Roto, mojado o muy marcado. No se vende." },
  { id: "clearance", name: "Saldo", help: "Con detalles. Se vende con descuento." },
];

export async function createReturn(c: Ctx, customerId: number) {
  const [cust] = await c.db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, c.companyId)));
  if (!cust) throw new UserError("RET-01", "Elige un cliente de la lista.");
  const [{ n }] = await c.db.select({ n: count() }).from(returns).where(eq(returns.companyId, c.companyId));
  const [d] = await c.db.insert(returns).values({ companyId: c.companyId, customerId, number: `DEV-${String(n + 1).padStart(4, "0")}` }).returning();
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
  if (!status) throw new UserError("RET-04", "Elige en qué estado está el libro.");
  await open(c, returnId);
  const p = await findProduct(c.db, c.companyId, code);
  await c.db
    .insert(returnLines)
    .values({ returnId, productId: p.id, bookCondition: status.id, quantity: n })
    .onConflictDoUpdate({ target: [returnLines.returnId, returnLines.productId, returnLines.bookCondition], set: { quantity: sql`${returnLines.quantity} + ${n}` } });
  return `${n} × ${p.title} → ${status.name}`;
}

export async function removeReturnLine(c: Ctx, returnId: number, productId: number, bookCondition: string) {
  await open(c, returnId);
  await c.db.delete(returnLines).where(and(eq(returnLines.returnId, returnId), eq(returnLines.productId, productId), eq(returnLines.bookCondition, bookCondition as BookCondition)));
  return "Línea quitada.";
}

/** Closes the return: each book enters stock in the zone its condition calls for. */
export async function closeReturn(c: Ctx, returnId: number) {
  const d = await open(c, returnId);
  return c.db.transaction(async (tx) => {
    const lines = await tx.select().from(returnLines).where(eq(returnLines.returnId, returnId));
    if (lines.length === 0) throw new UserError("RET-05", "Todavía no escaneaste ningún libro.");
    const destination = { sellable: await zone(tx, c.companyId, "returns"), damaged: await zone(tx, c.companyId, "damaged"), clearance: await zone(tx, c.companyId, "clearance") };
    for (const l of lines) {
      await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: null, toId: destination[l.bookCondition].id, quantity: l.quantity, reason: "return", reference: d.number, userId: c.userId });
    }
    await tx.update(returns).set({ status: "closed" }).where(eq(returns.id, returnId));
    const sellables = lines.filter((l) => l.bookCondition === "sellable").reduce((s, l) => s + l.quantity, 0);
    return `Devolución ${d.number} cerrada. ${sellables} unidades vendibles esperan para guardar.`;
  });
}
