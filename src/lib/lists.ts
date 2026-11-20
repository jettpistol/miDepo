import { and, asc, count, desc, eq, inArray, max, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DB } from "@/db";
import { customers, locations, movements, orders, products, receivingLines, receivings, returnLines, returns, suppliers, users, type MovementReason, type OrderStatus } from "@/db/schema";
import { containsText } from "./lookup";

/**
 * The read-only lists behind the register screens (Proveedores, Clientes, Pedidos, Movimientos):
 * everything in the database, a page at a time, narrowed by what was typed.
 */

export type Paging = { limit: number; offset: number };
const clean = (q: string) => q.replace(/[%_\\]/g, "").trim();

export async function listSuppliers(db: DB, companyId: number, q: string, page: Paging) {
  const text = clean(q);
  const where = and(eq(suppliers.companyId, companyId), text ? containsText(suppliers.name, text) : undefined);
  const [[{ n: total }], rows] = await Promise.all([
    db.select({ n: count() }).from(suppliers).where(where),
    db
      .select({ id: suppliers.id, name: suppliers.name, createdAt: suppliers.createdAt, createdBy: users.name, receivings: count(receivings.id), last: max(receivings.date) })
      .from(suppliers)
      .leftJoin(users, eq(users.id, suppliers.createdBy))
      .leftJoin(receivings, eq(receivings.supplierId, suppliers.id))
      .where(where)
      .groupBy(suppliers.id, users.name)
      .orderBy(asc(suppliers.name))
      .limit(page.limit)
      .offset(page.offset),
  ]);
  return { total, rows };
}

// Correlated subqueries name their columns in full: Drizzle drops the table name when a query
// reads a single table, and an unqualified "id" would then mean the subquery's own table.
export async function listCustomers(db: DB, companyId: number, q: string, page: Paging) {
  const text = clean(q);
  const where = and(eq(customers.companyId, companyId), text ? or(containsText(customers.name, text), containsText(customers.city, text), containsText(customers.province, text)) : undefined);
  const [[{ n: total }], rows] = await Promise.all([
    db.select({ n: count() }).from(customers).where(where),
    db
      .select({
        c: customers,
        orders: sql<number>`(select count(*) from "orders" o where o.customer_id = "customers"."id")`.mapWith(Number),
        returns: sql<number>`(select count(*) from "returns" r where r.customer_id = "customers"."id")`.mapWith(Number),
      })
      .from(customers)
      .where(where)
      .orderBy(asc(customers.name))
      .limit(page.limit)
      .offset(page.offset),
  ]);
  return { total, rows };
}

export const ORDER_STATUSES = ["pending", "in_picking", "to_control", "picked", "packed", "shipped", "cancelled"] as const satisfies readonly OrderStatus[];

/** Orders of any state, newest first. `customerId` narrows to one customer's orders. */
export async function listOrders(db: DB, companyId: number, f: { q?: string; status?: OrderStatus; customerId?: number }, page: Paging) {
  const text = clean(f.q ?? "");
  const base = and(
    eq(orders.companyId, companyId),
    f.customerId ? eq(orders.customerId, f.customerId) : undefined,
    text ? or(sql`upper(${orders.number}) like ${`%${text.toUpperCase()}%`}`, containsText(customers.name, text)) : undefined,
  );
  const where = and(base, f.status ? eq(orders.status, f.status) : undefined);
  const [byStatus, rows] = await Promise.all([
    db.select({ status: orders.status, n: count() }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(base).groupBy(orders.status),
    db
      .select({
        o: orders,
        customer: customers.name,
        units: sql<number>`(select coalesce(sum(l.quantity), 0) from "order_lines" l where l.order_id = "orders"."id")`.mapWith(Number),
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(where)
      .orderBy(desc(orders.date), desc(orders.id))
      .limit(page.limit)
      .offset(page.offset),
  ]);
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const r of byStatus) counts[r.status] = r.n;
  const all = byStatus.reduce((s, r) => s + r.n, 0);
  return { counts, all, total: f.status ? counts[f.status] : all, rows };
}

/** Where an order is worked on: picking until it is picked, packing after. */
export const orderScreen = (status: OrderStatus) => (status === "pending" || status === "in_picking" ? "picking" : status === "to_control" ? "control" : "empaque");

export const MOVEMENT_REASONS = ["initial", "receiving", "putaway", "movement", "picking", "shipment", "return", "count_adjustment", "count_relocation", "missing", "found", "write_off"] as const satisfies readonly MovementReason[];
/** What each movement reason is called on screen. */
export const MOVEMENT_REASON_NAME = { initial: "Carga inicial", receiving: "Recepción", putaway: "Reposición", movement: "Movimiento", picking: "Picking", shipment: "Despacho", return: "Devolución", count_adjustment: "Ajuste por conteo", count_relocation: "Mal ubicado (conteo)", missing: "Faltante en picking", found: "Apareció", write_off: "Baja", undo: "Deshecho", transfer_out: "Salida", transfer_back: "Regreso de salida", sold_outside: "Vendido fuera" } as const satisfies Record<MovementReason, string>;
export const isMovementReason = (v: string): v is MovementReason => (MOVEMENT_REASONS as readonly string[]).includes(v);

/**
 * The warehouse's whole movement log, newest first. What was typed matches the article (title,
 * author, barcode, ISBN, internal code), either location's code, the document number or the user.
 */
export async function listMovements(db: DB, companyId: number, f: { q?: string; reason?: MovementReason }, page: Paging) {
  const text = clean(f.q ?? "");
  const fromLoc = alias(locations, "from_loc");
  const toLoc = alias(locations, "to_loc");
  const upper = text.toUpperCase();
  const match: SQL | undefined = text
    ? or(
        eq(products.barcode, text),
        eq(products.isbn, text),
        eq(products.internalCode, upper),
        containsText(products.title, text),
        containsText(products.author, text),
        sql`${fromLoc.code} like ${`${upper}%`}`,
        sql`${toLoc.code} like ${`${upper}%`}`,
        sql`upper(${movements.reference}) like ${`%${upper}%`}`,
        containsText(users.name, text),
      )
    : undefined;
  const where = and(eq(movements.companyId, companyId), f.reason ? eq(movements.reason, f.reason) : undefined, match);
  const [[{ n: total }], rows] = await Promise.all([
    db
      .select({ n: count() })
      .from(movements)
      .innerJoin(products, eq(products.id, movements.productId))
      .leftJoin(fromLoc, eq(fromLoc.id, movements.fromId))
      .leftJoin(toLoc, eq(toLoc.id, movements.toId))
      .leftJoin(users, eq(users.id, movements.userId))
      .where(where),
    db
      .select({ m: movements, productId: products.id, title: products.title, barcode: products.barcode, fromLoc: fromLoc.code, toLoc: toLoc.code, who: users.name })
      .from(movements)
      .innerJoin(products, eq(products.id, movements.productId))
      .leftJoin(fromLoc, eq(fromLoc.id, movements.fromId))
      .leftJoin(toLoc, eq(toLoc.id, movements.toId))
      .leftJoin(users, eq(users.id, movements.userId))
      .where(where)
      .orderBy(desc(movements.id))
      .limit(page.limit)
      .offset(page.offset),
  ]);
  return { total, rows };
}

export type ReceivingRow = { r: typeof receivings.$inferSelect; supplier: string; supplierId: number; titles: number; received: number };

/** Receivings matching `where`, newest first, with what was counted in each. */
export async function receivingRows(db: DB, companyId: number, where: SQL | undefined, page: { limit: number; offset: number }, q = "") {
  const text = q.replace(/[%_\\]/g, "").trim();
  const filter = and(eq(receivings.companyId, companyId), where, text ? or(sql`upper(${receivings.number}) like ${`%${text.toUpperCase()}%`}`, containsText(suppliers.name, text)) : undefined);
  const [[{ n: total }], rows] = await Promise.all([
    db.select({ n: count() }).from(receivings).innerJoin(suppliers, eq(suppliers.id, receivings.supplierId)).where(filter),
    db
      .select({ r: receivings, supplier: suppliers.name, supplierId: suppliers.id })
      .from(receivings)
      .innerJoin(suppliers, eq(suppliers.id, receivings.supplierId))
      .where(filter)
      .orderBy(desc(receivings.date), desc(receivings.id))
      .limit(page.limit)
      .offset(page.offset),
  ]);
  const sums = new Map<number, { titles: number; received: number }>();
  if (rows.length > 0) {
    const lines = await db
      .select({ id: receivingLines.receivingId, titles: count(), received: sql<number>`coalesce(sum(${receivingLines.received}), 0)`.mapWith(Number) })
      .from(receivingLines)
      .where(inArray(receivingLines.receivingId, rows.map((x) => x.r.id)))
      .groupBy(receivingLines.receivingId);
    for (const l of lines) sums.set(l.id, l);
  }
  return { total, rows: rows.map((x) => ({ ...x, titles: sums.get(x.r.id)?.titles ?? 0, received: sums.get(x.r.id)?.received ?? 0 })) };
}

export type ReturnRow = { d: typeof returns.$inferSelect; customer: string; customerId: number; units: number };

/** Returns matching `where`, newest first, with their units. */
export async function returnRows(db: DB, companyId: number, where: SQL | undefined, page: { limit: number; offset: number }, q = "") {
  const text = q.replace(/[%_\\]/g, "").trim();
  const filter = and(eq(returns.companyId, companyId), where, text ? or(sql`upper(${returns.number}) like ${`%${text.toUpperCase()}%`}`, containsText(customers.name, text)) : undefined);
  const [[{ n: total }], rows] = await Promise.all([
    db.select({ n: count() }).from(returns).innerJoin(customers, eq(customers.id, returns.customerId)).where(filter),
    db
      .select({ d: returns, customer: customers.name, customerId: customers.id, units: sql<number>`coalesce(sum(${returnLines.quantity}), 0)`.mapWith(Number) })
      .from(returns)
      .innerJoin(customers, eq(customers.id, returns.customerId))
      .leftJoin(returnLines, eq(returnLines.returnId, returns.id))
      .where(filter)
      .groupBy(returns.id, customers.name, customers.id)
      .orderBy(desc(returns.date), desc(returns.id))
      .limit(page.limit)
      .offset(page.offset),
  ]);
  return { total, rows };
}
