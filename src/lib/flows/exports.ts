import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import type { DB } from "@/db";
import { adjustmentLines, adjustments, boxItems, boxes, customers, countLines, counts, returnLines, returns, companies, orderLines, orders, products, receivingLines, receivings, suppliers, locations, users } from "@/db/schema";
import { UserError } from "../errors";
import { connector, sync, type Company } from "../fierro";
import { fierroCode, csv } from "../fierro/csv";
import type { FierroDocument } from "../fierro/types";
import { moveStock, zone } from "../stock";
import type { Ctx } from "./common";
import { causeName } from "./adjustments";

export const EXPORT_TYPES = ["order", "receiving", "return", "count", "adjustment"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];
export const isExportType = (v: string): v is ExportType => (EXPORT_TYPES as readonly string[]).includes(v);
/** The files go to Fierro, so the condition keeps the Spanish word Fierro users know. */
const CONDITION_FOR_FIERRO = { sellable: "vendible", clearance: "saldo", damaged: "danado" } as const;

export const EXPORT_NAME: Record<ExportType, string> = { order: "Pedido empacado", receiving: "Recepción", return: "Devolución", count: "Conteo", adjustment: "Baja de stock" };

export type Pending = { type: ExportType; id: number; number: string; detail: string; date: Date };

/** Everything the warehouse has finished that Fierro does not know about yet. */
export async function pendingExports(db: DB, companyId: number): Promise<Pending[]> {
  const [ps, rs, ds, ks, as] = await Promise.all([
    db.select({ id: orders.id, number: orders.number, detail: customers.name, date: orders.date }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(and(eq(orders.companyId, companyId), eq(orders.status, "packed"), isNull(orders.sentToFierro))),
    db.select({ id: receivings.id, number: receivings.number, detail: suppliers.name, date: receivings.date }).from(receivings).innerJoin(suppliers, eq(suppliers.id, receivings.supplierId)).where(and(eq(receivings.companyId, companyId), eq(receivings.status, "closed"), isNull(receivings.sentToFierro))),
    db.select({ id: returns.id, number: returns.number, detail: customers.name, date: returns.date }).from(returns).innerJoin(customers, eq(customers.id, returns.customerId)).where(and(eq(returns.companyId, companyId), eq(returns.status, "closed"), isNull(returns.sentToFierro))),
    db.select({ id: counts.id, number: counts.name, date: counts.date }).from(counts).where(and(eq(counts.companyId, companyId), eq(counts.status, "closed"), isNull(counts.sentToFierro))),
    // A count's own adjustment travels with the count.
    db.select({ id: adjustments.id, number: adjustments.number, date: adjustments.createdAt, detail: users.name }).from(adjustments).innerJoin(users, eq(users.id, adjustments.approvedBy)).where(and(eq(adjustments.companyId, companyId), isNull(adjustments.countId), isNull(adjustments.sentToFierro))),
  ]);
  return [
    ...ps.map((p) => ({ type: "order" as const, ...p })),
    ...rs.map((r) => ({ type: "receiving" as const, ...r })),
    ...ds.map((d) => ({ type: "return" as const, ...d })),
    ...ks.map((k) => ({ type: "count" as const, ...k, detail: "Ajustes de stock por ubicación" })),
    ...as.map((a) => ({ type: "adjustment" as const, ...a, detail: `Aprobado por ${a.detail}` })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type Sent = Pending & { sent: Date };

/** Everything already marked as loaded in Fierro, last loaded first, a page at a time. */
export async function sentExports(db: DB, companyId: number, page: { limit: number; offset: number }): Promise<{ total: number; rows: Sent[] }> {
  const t = (type: ExportType) => sql<ExportType>`${type}::text`.as("type");
  const all = unionAll(
    db.select({ type: t("order"), id: orders.id, number: orders.number, detail: customers.name, date: orders.date, sent: sql<Date>`${orders.sentToFierro}`.as("sent") }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(and(eq(orders.companyId, companyId), isNotNull(orders.sentToFierro))),
    db.select({ type: t("receiving"), id: receivings.id, number: receivings.number, detail: suppliers.name, date: receivings.date, sent: sql<Date>`${receivings.sentToFierro}`.as("sent") }).from(receivings).innerJoin(suppliers, eq(suppliers.id, receivings.supplierId)).where(and(eq(receivings.companyId, companyId), isNotNull(receivings.sentToFierro))),
    db.select({ type: t("return"), id: returns.id, number: returns.number, detail: customers.name, date: returns.date, sent: sql<Date>`${returns.sentToFierro}`.as("sent") }).from(returns).innerJoin(customers, eq(customers.id, returns.customerId)).where(and(eq(returns.companyId, companyId), isNotNull(returns.sentToFierro))),
    db.select({ type: t("count"), id: counts.id, number: counts.name, detail: sql<string>`'Ajustes de stock por ubicación'`.as("detail"), date: counts.date, sent: sql<Date>`${counts.sentToFierro}`.as("sent") }).from(counts).where(and(eq(counts.companyId, companyId), isNotNull(counts.sentToFierro))),
    // A count's own adjustment travels with the count, so it is listed under the count.
    db.select({ type: t("adjustment"), id: adjustments.id, number: adjustments.number, detail: sql<string>`'Aprobado por ' || ${users.name}`.as("detail"), date: adjustments.createdAt, sent: sql<Date>`${adjustments.sentToFierro}`.as("sent") }).from(adjustments).innerJoin(users, eq(users.id, adjustments.approvedBy)).where(and(eq(adjustments.companyId, companyId), isNull(adjustments.countId), isNotNull(adjustments.sentToFierro))),
  ).as("sent_docs");
  const [[{ n: total }], rows] = await Promise.all([
    db.select({ n: count() }).from(all),
    db.select().from(all).orderBy(desc(all.sent), desc(all.id)).limit(page.limit).offset(page.offset),
  ]);
  // Drivers differ on timestamps inside a subquery: some return strings.
  return { total, rows: rows.map((r) => ({ ...r, date: new Date(r.date), sent: new Date(r.sent) })) };
}

/** Builds the CSV file of a document to be loaded into Fierro. */
export async function fileFor(db: DB, companyId: number, type: ExportType, id: number): Promise<{ name: string; contents: string }> {
  if (type === "order") {
    const [p] = await db.select({ number: orders.number, customer: customers.name }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(and(eq(orders.id, id), eq(orders.companyId, companyId)));
    if (!p) throw new UserError("EXP-01", "No se encontró ese pedido.");
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
    const [r] = await db.select({ number: receivings.number, supplier: suppliers.name }).from(receivings).innerJoin(suppliers, eq(suppliers.id, receivings.supplierId)).where(and(eq(receivings.id, id), eq(receivings.companyId, companyId)));
    if (!r) throw new UserError("EXP-02", "No se encontró esa recepción.");
    const rows = await db.select({ isbn: products.isbn, internalCode: products.internalCode, title: products.title, expected: receivingLines.expected, received: receivingLines.received }).from(receivingLines).innerJoin(products, eq(products.id, receivingLines.productId)).where(eq(receivingLines.receivingId, id)).orderBy(asc(products.title));
    return { name: `recepcion-${r.number}.csv`, contents: csv(rows.map((f) => [r.number, r.supplier, fierroCode(f), f.title, f.expected, f.received]), ["recepcion", "proveedor", "codigo", "titulo", "esperado", "recibido"]) };
  }
  if (type === "return") {
    const [d] = await db.select({ number: returns.number, customer: customers.name }).from(returns).innerJoin(customers, eq(customers.id, returns.customerId)).where(and(eq(returns.id, id), eq(returns.companyId, companyId)));
    if (!d) throw new UserError("EXP-03", "No se encontró esa devolución.");
    const rows = await db.select({ isbn: products.isbn, internalCode: products.internalCode, title: products.title, status: returnLines.bookCondition, quantity: returnLines.quantity }).from(returnLines).innerJoin(products, eq(products.id, returnLines.productId)).where(eq(returnLines.returnId, id)).orderBy(asc(products.title));
    return { name: `devolucion-${d.number}.csv`, contents: csv(rows.map((f) => [d.number, d.customer, fierroCode(f), f.title, CONDITION_FOR_FIERRO[f.status], f.quantity]), ["devolucion", "cliente", "codigo", "titulo", "estado", "cantidad"]) };
  }
  if (type === "adjustment") {
    const [a] = await db.select().from(adjustments).where(and(eq(adjustments.id, id), eq(adjustments.companyId, companyId)));
    if (!a) throw new UserError("EXP-12", "No se encontró esa baja.");
    const rows = await db
      .select({ isbn: products.isbn, internalCode: products.internalCode, title: products.title, location: locations.code, quantity: adjustmentLines.quantity, cause: adjustmentLines.cause })
      .from(adjustmentLines)
      .innerJoin(products, eq(products.id, adjustmentLines.productId))
      .innerJoin(locations, eq(locations.id, adjustmentLines.locationId))
      .where(eq(adjustmentLines.adjustmentId, id))
      .orderBy(asc(products.title));
    // Negative quantity = leaves the stock. The cause is the reason Fierro's stock document should carry.
    return { name: `ajuste-${a.number}.csv`, contents: csv(rows.map((f) => [a.number, fierroCode(f), f.title, f.location, f.quantity, causeName(f.cause)]), ["ajuste", "codigo", "titulo", "ubicacion", "cantidad", "motivo"]) };
  }
  const [k] = await db.select().from(counts).where(and(eq(counts.id, id), eq(counts.companyId, companyId)));
  if (!k) throw new UserError("EXP-04", "No se encontró ese conteo.");
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
      if (flagged.length === 0) throw new UserError("EXP-05", "Ese pedido no está listo para cargar en Fierro.");
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
      if (flagged.length === 0) throw new UserError("EXP-06", "Esa recepción no está pendiente de carga en Fierro.");
      doc.reference = flagged[0].number;
      doc.lines = (await tx.select().from(receivingLines).where(eq(receivingLines.receivingId, id))).map((l) => ({ productId: l.productId, delta: l.received }));
    } else if (type === "return") {
      const flagged = await tx.update(returns).set({ sentToFierro: now }).where(and(eq(returns.id, id), eq(returns.companyId, c.companyId), eq(returns.status, "closed"), isNull(returns.sentToFierro))).returning();
      if (flagged.length === 0) throw new UserError("EXP-07", "Esa devolución no está pendiente de carga en Fierro.");
      doc.type = "return";
      doc.reference = flagged[0].number;
      doc.lines = (await tx.select().from(returnLines).where(eq(returnLines.returnId, id))).map((l) => ({ productId: l.productId, delta: l.quantity }));
    } else if (type === "adjustment") {
      const flagged = await tx.update(adjustments).set({ sentToFierro: now }).where(and(eq(adjustments.id, id), eq(adjustments.companyId, c.companyId), isNull(adjustments.countId), isNull(adjustments.sentToFierro))).returning();
      if (flagged.length === 0) throw new UserError("EXP-13", "Esa baja no está pendiente de carga en Fierro.");
      doc.type = "adjustment";
      doc.reference = flagged[0].number;
      doc.lines = (await tx.select().from(adjustmentLines).where(eq(adjustmentLines.adjustmentId, id))).map((l) => ({ productId: l.productId, delta: l.quantity }));
    } else {
      const flagged = await tx.update(counts).set({ sentToFierro: now }).where(and(eq(counts.id, id), eq(counts.companyId, c.companyId), eq(counts.status, "closed"), isNull(counts.sentToFierro))).returning();
      if (flagged.length === 0) throw new UserError("EXP-08", "Ese conteo no está pendiente de carga en Fierro.");
      doc.type = "count";
      doc.reference = flagged[0].name;
      const [own] = await tx.update(adjustments).set({ sentToFierro: now }).where(eq(adjustments.countId, id)).returning();
      // The total stock only changes by what was found or written off; misplaced units and units
      // back from FALTANTES were never out of Fierro's stock. Counts closed before adjustment
      // documents existed fall back to counted minus system.
      doc.lines = own
        ? (await tx.select().from(adjustmentLines).where(eq(adjustmentLines.adjustmentId, own.id))).map((l) => ({ productId: l.productId, delta: l.quantity }))
        : (await tx.select().from(countLines).where(eq(countLines.countId, id))).map((l) => ({ productId: l.productId, delta: l.countedQty - (l.system ?? l.countedQty) }));
    }
    await connector(tx, company).submit(doc);
    return `${EXPORT_NAME[type]} ${doc.reference}: cargado en Fierro.`;
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
