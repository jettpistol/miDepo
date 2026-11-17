import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { boxItems, boxes, customers, countLines, counts, returnLines, returns, companies, orderLines, orders, products, receivingLines, receivings, locations } from "@/db/schema";
import { UserError } from "../errors";
import { connector, sync, type Company } from "../fierro";
import { fierroCode, csv } from "../fierro/csv";
import type { FierroDocument } from "../fierro/types";
import { moveStock, zone } from "../stock";
import type { Ctx } from "./common";

export type ExportType = "order" | "receiving" | "return" | "count";
/** The files go to Fierro, so the condition keeps the Spanish word Fierro users know. */
const CONDITION_FOR_FIERRO = { sellable: "vendible", clearance: "saldo", damaged: "danado" } as const;

export const EXPORT_NAME: Record<ExportType, string> = { order: "Pedido empacado", receiving: "Recepción", return: "Devolución", count: "Conteo" };

export type Pending = { type: ExportType; id: number; number: string; detail: string; date: Date };

/** Everything the warehouse has finished that Fierro does not know about yet. */
export async function pendingExports(db: DB, companyId: number): Promise<Pending[]> {
  const [ps, rs, ds, ks] = await Promise.all([
    db.select({ id: orders.id, number: orders.number, detail: customers.name, date: orders.date }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(and(eq(orders.companyId, companyId), eq(orders.status, "packed"), isNull(orders.sentToFierro))),
    db.select({ id: receivings.id, number: receivings.number, detail: receivings.supplier, date: receivings.date }).from(receivings).where(and(eq(receivings.companyId, companyId), eq(receivings.status, "closed"), isNull(receivings.sentToFierro))),
    db.select({ id: returns.id, number: returns.number, detail: customers.name, date: returns.date }).from(returns).innerJoin(customers, eq(customers.id, returns.customerId)).where(and(eq(returns.companyId, companyId), eq(returns.status, "closed"), isNull(returns.sentToFierro))),
    db.select({ id: counts.id, number: counts.name, date: counts.date }).from(counts).where(and(eq(counts.companyId, companyId), eq(counts.status, "closed"), isNull(counts.sentToFierro))),
  ]);
  return [
    ...ps.map((p) => ({ type: "order" as const, ...p })),
    ...rs.map((r) => ({ type: "receiving" as const, ...r })),
    ...ds.map((d) => ({ type: "return" as const, ...d })),
    ...ks.map((k) => ({ type: "count" as const, ...k, detail: "Ajustes de stock por ubicación" })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Builds the CSV file of a document to be loaded into Fierro. */
export async function fileFor(db: DB, companyId: number, type: ExportType, id: number): Promise<{ name: string; contents: string }> {
  if (type === "order") {
    const [p] = await db.select({ number: orders.number, customer: customers.name }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(and(eq(orders.id, id), eq(orders.companyId, companyId)));
    if (!p) throw new UserError("No encuentro ese pedido.");
    const rows = await db
      .select({ box: boxes.number, weight: boxes.weightGrams, isbn: products.isbn, internalCode: products.internalCode, title: products.title, quantity: boxItems.quantity })
      .from(boxItems)
      .innerJoin(boxes, eq(boxes.id, boxItems.boxId))
      .innerJoin(products, eq(products.id, boxItems.productId))
      .where(eq(boxes.orderId, id))
      .orderBy(asc(boxes.number), asc(products.title));
    return { name: `pedido-${p.number}.csv`, contents: csv(rows.map((f) => [p.number, p.customer, f.box, fierroCode(f), f.title, f.quantity, f.weight]), ["pedido", "cliente", "caja", "codigo", "titulo", "cantidad", "peso_caja_gramos"]) };
  }
  if (type === "receiving") {
    const [r] = await db.select().from(receivings).where(and(eq(receivings.id, id), eq(receivings.companyId, companyId)));
    if (!r) throw new UserError("No encuentro esa recepción.");
    const rows = await db.select({ isbn: products.isbn, internalCode: products.internalCode, title: products.title, expected: receivingLines.expected, received: receivingLines.received }).from(receivingLines).innerJoin(products, eq(products.id, receivingLines.productId)).where(eq(receivingLines.receivingId, id)).orderBy(asc(products.title));
    return { name: `recepcion-${r.number}.csv`, contents: csv(rows.map((f) => [r.number, r.supplier, fierroCode(f), f.title, f.expected, f.received]), ["recepcion", "proveedor", "codigo", "titulo", "esperado", "recibido"]) };
  }
  if (type === "return") {
    const [d] = await db.select({ number: returns.number, customer: customers.name }).from(returns).innerJoin(customers, eq(customers.id, returns.customerId)).where(and(eq(returns.id, id), eq(returns.companyId, companyId)));
    if (!d) throw new UserError("No encuentro esa devolución.");
    const rows = await db.select({ isbn: products.isbn, internalCode: products.internalCode, title: products.title, status: returnLines.bookCondition, quantity: returnLines.quantity }).from(returnLines).innerJoin(products, eq(products.id, returnLines.productId)).where(eq(returnLines.returnId, id)).orderBy(asc(products.title));
    return { name: `devolucion-${d.number}.csv`, contents: csv(rows.map((f) => [d.number, d.customer, fierroCode(f), f.title, CONDITION_FOR_FIERRO[f.status], f.quantity]), ["devolucion", "cliente", "codigo", "titulo", "estado", "cantidad"]) };
  }
  const [k] = await db.select().from(counts).where(and(eq(counts.id, id), eq(counts.companyId, companyId)));
  if (!k) throw new UserError("No encuentro ese conteo.");
  const rows = await db
    .select({ isbn: products.isbn, internalCode: products.internalCode, countedQty: countLines.countedQty, location: locations.code })
    .from(countLines)
    .innerJoin(products, eq(products.id, countLines.productId))
    .innerJoin(locations, eq(locations.id, countLines.locationId))
    .where(eq(countLines.countId, id))
    .orderBy(asc(locations.code));
  // Same format as Fierro's "inventory count import": code, quantity, location; no header row.
  return { name: `conteo-${k.id}.csv`, contents: csv(rows.filter((f) => f.countedQty > 0).map((f) => [fierroCode(f), f.countedQty, f.location])) };
}

/**
 * Marks a document as reported to Fierro. With the simulated Fierro it also updates its
 * stock, as the office would by loading the file. This is where an order leaves the warehouse.
 */
export async function markSent(c: Ctx, company: Company, type: ExportType, id: number) {
  return c.db.transaction(async (tx) => {
    const doc: FierroDocument = { type: "receiving", reference: "", lines: [] };
    const now = new Date();
    if (type === "order") {
      const flagged = await tx.update(orders).set({ status: "shipped", sentToFierro: now }).where(and(eq(orders.id, id), eq(orders.companyId, c.companyId), eq(orders.status, "packed"))).returning();
      if (flagged.length === 0) throw new UserError("Ese pedido no está listo para documentar.");
      const prep = await zone(tx, c.companyId, "staging");
      const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, id));
      for (const l of lines) {
        if (l.packed === 0) continue;
        await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: prep.id, toId: null, quantity: l.packed, reason: "shipment", reference: flagged[0].number, userId: c.userId });
        doc.lines.push({ productId: l.productId, delta: -l.packed });
      }
      doc.type = "shipment";
      doc.reference = flagged[0].number;
    } else if (type === "receiving") {
      const flagged = await tx.update(receivings).set({ sentToFierro: now }).where(and(eq(receivings.id, id), eq(receivings.companyId, c.companyId), eq(receivings.status, "closed"), isNull(receivings.sentToFierro))).returning();
      if (flagged.length === 0) throw new UserError("Esa recepción no está pendiente de envío.");
      doc.reference = flagged[0].number;
      doc.lines = (await tx.select().from(receivingLines).where(eq(receivingLines.receivingId, id))).map((l) => ({ productId: l.productId, delta: l.received }));
    } else if (type === "return") {
      const flagged = await tx.update(returns).set({ sentToFierro: now }).where(and(eq(returns.id, id), eq(returns.companyId, c.companyId), eq(returns.status, "closed"), isNull(returns.sentToFierro))).returning();
      if (flagged.length === 0) throw new UserError("Esa devolución no está pendiente de envío.");
      doc.type = "return";
      doc.reference = flagged[0].number;
      doc.lines = (await tx.select().from(returnLines).where(eq(returnLines.returnId, id))).map((l) => ({ productId: l.productId, delta: l.quantity }));
    } else {
      const flagged = await tx.update(counts).set({ sentToFierro: now }).where(and(eq(counts.id, id), eq(counts.companyId, c.companyId), eq(counts.status, "closed"), isNull(counts.sentToFierro))).returning();
      if (flagged.length === 0) throw new UserError("Ese conteo no está pendiente de envío.");
      doc.type = "count";
      doc.reference = flagged[0].name;
      doc.lines = (await tx.select().from(countLines).where(eq(countLines.countId, id))).map((l) => ({ productId: l.productId, delta: l.countedQty - (l.system ?? l.countedQty) }));
    }
    await connector(tx, company).submit(doc);
    return `${EXPORT_NAME[type]} ${doc.reference}: marcado como cargado en Fierro.`;
  });
}

/** Simulated Fierro only: makes new orders or receipts appear "on the other side". */
export async function simulateNews(db: DB, company: Company, what: "orders" | "receipts", howManyOf: number) {
  const [current] = await db
    .update(companies)
    .set(what === "orders" ? { simOrders: sql`${companies.simOrders} + ${howManyOf}` } : { simReceipts: sql`${companies.simReceipts} + ${howManyOf}` })
    .where(eq(companies.id, company.id))
    .returning();
  return sync(db, current);
}
