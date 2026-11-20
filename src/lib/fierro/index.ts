import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { customers, companies, fierroStock, orderLines, orders, products, receivingLines, receivings, suppliers } from "@/db/schema";
import { makeThumbnails } from "@/lib/covers";
import { SimulatedFierro } from "./simulated";
import type { FierroConnector, FierroOrder } from "./types";

export type Company = typeof companies.$inferSelect;

/** When the real connector exists, it is chosen here from the company's configuration. */
export function connector(db: Executor, company: Company): FierroConnector {
  return new SimulatedFierro(db, company);
}

const inBatches = <T,>(list: T[], n = 400) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/**
 * Brings catalogue, customers, orders and expected receipts from Fierro. Fierro rules: what
 * changed there overwrites what is here. Orders already started are not changed: a change Fierro
 * made to one is only flagged (fierro_change) and applied once the order is released to Pendientes.
 */
export async function sync(db: DB, company: Company, fierro: FierroConnector = connector(db, company)) {
  const [books, custs, ords, rcpts] = await Promise.all([fierro.books(), fierro.customers(), fierro.pendingOrders(), fierro.expectedReceipts()]);
  // Read before the transaction opens: inside it only `tx` may be used.
  const fierroQty = await fierro.stock();
  const summary = { titles: books.length, customers: custs.length, newOrders: 0, changedOrders: 0, cancelledOrders: 0, flaggedOrders: 0, skippedOrders: 0, newReceipts: 0 };

  await db.transaction(async (tx) => {
    for (const batch of inBatches(books)) {
      await tx
        .insert(products)
        .values(batch.map((l) => ({ companyId: company.id, fierroId: l.id, internalCode: l.internalCode, isbn: l.isbn, barcode: l.barcode, title: l.title, author: l.author, imprint: l.imprint, type: l.type, price: l.price, weightGrams: l.weightGrams, coverUrl: l.coverUrl ?? null })))
        .onConflictDoUpdate({
          target: [products.companyId, products.fierroId],
          set: { internalCode: sql`excluded.internal_code`, isbn: sql`excluded.isbn`, barcode: sql`excluded.barcode`, title: sql`excluded.title`, author: sql`excluded.author`, imprint: sql`excluded.imprint`, type: sql`excluded.type`, price: sql`excluded.price`, weightGrams: sql`excluded.weight_grams`, coverUrl: sql`excluded.cover_url` },
        });
    }
    for (const batch of inBatches(custs)) {
      await tx
        .insert(customers)
        .values(batch.map((c) => ({ companyId: company.id, fierroId: c.id, name: c.name, address: c.address, city: c.city, province: c.province })))
        .onConflictDoUpdate({
          target: [customers.companyId, customers.fierroId],
          set: { name: sql`excluded.name`, address: sql`excluded.address`, city: sql`excluded.city`, province: sql`excluded.province` },
        });
    }

    const productRef = new Map((await tx.select({ id: products.id, f: products.fierroId }).from(products).where(eq(products.companyId, company.id))).map((p) => [p.f, p.id]));
    const customerRef = new Map((await tx.select({ id: customers.id, f: customers.fierroId }).from(customers).where(eq(customers.companyId, company.id))).map((c) => [c.f, c.id]));

    await syncOrders(tx, company.id, ords, productRef, customerRef, summary);

    const existingReceipts = new Set((await tx.select({ f: receivings.fierroId }).from(receivings).where(eq(receivings.companyId, company.id))).map((r) => r.f));
    // Suppliers named on Fierro's receipts join the supplier list (matched by name, case-insensitively).
    const names = [...new Set(rcpts.filter((i) => !existingReceipts.has(i.id)).map((i) => i.supplier.trim()))];
    if (names.length > 0) await tx.insert(suppliers).values(names.map((name) => ({ companyId: company.id, name }))).onConflictDoNothing();
    const supplierId = new Map((await tx.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.companyId, company.id))).map((s) => [s.name.toLowerCase(), s.id]));
    for (const i of rcpts) {
      if (existingReceipts.has(i.id)) continue;
      const ls = i.lines.flatMap((l) => (productRef.has(l.bookId) ? [{ productId: productRef.get(l.bookId)!, expected: l.quantity }] : []));
      if (ls.length === 0) continue;
      const [receiving] = await tx.insert(receivings).values({ companyId: company.id, fierroId: i.id, number: i.number, supplierId: supplierId.get(i.supplier.trim().toLowerCase())!, date: i.date }).returning({ id: receivings.id });
      await tx.insert(receivingLines).values(ls.map((l) => ({ receivingId: receiving.id, ...l })));
      summary.newReceipts++;
    }

    // Snapshot of stock according to Fierro, for the reconciliation.
    const rows = [...fierroQty].flatMap(([f, quantity]) => (productRef.has(f) ? [{ companyId: company.id, productId: productRef.get(f)!, quantity }] : []));
    for (const batch of inBatches(rows, 1000)) {
      await tx.insert(fierroStock).values(batch).onConflictDoUpdate({ target: [fierroStock.companyId, fierroStock.productId], set: { quantity: sql`excluded.quantity` } });
    }
    await tx.update(companies).set({ lastSync: new Date() }).where(eq(companies.id, company.id));
  });
  // Outside the transaction: covers may come from the network, and a missing one blocks nothing.
  await makeThumbnails(db, company.id);
  return summary;
}


type Summary = { newOrders: number; changedOrders: number; cancelledOrders: number; flaggedOrders: number; skippedOrders: number };

/** "productId:quantity" pairs, sorted: two orders with the same lines give the same key. */
const linesKey = (ls: { productId: number; quantity: number }[]) =>
  ls.map((l) => `${l.productId}:${l.quantity}`).sort().join(",");

/**
 * Fierro's pending orders against miDepo's. New ones come in (also with lines for articles not yet in
 * the catalogue: those are counted in unknown_lines and the order cannot be taken). An order nobody
 * started follows Fierro: its lines are replaced if they changed, and it is cancelled if Fierro no
 * longer lists it (it comes back if Fierro lists it again). A started order is never changed here.
 */
async function syncOrders(tx: Executor, companyId: number, ords: FierroOrder[], productRef: Map<string, number>, customerRef: Map<string, number>, summary: Summary) {
  const mine = await tx.select().from(orders).where(and(eq(orders.companyId, companyId), inArray(orders.status, ["pending", "cancelled", "in_picking", "to_control", "picked", "packed"])));
  const byFierroId = new Map(mine.map((o) => [o.fierroId, o]));
  const shipped = new Set((await tx.select({ f: orders.fierroId }).from(orders).where(and(eq(orders.companyId, companyId), eq(orders.status, "shipped")))).map((o) => o.f));
  const linesOf = new Map<number, { productId: number; quantity: number }[]>();
  if (mine.length > 0) {
    for (const l of await tx.select({ orderId: orderLines.orderId, productId: orderLines.productId, quantity: orderLines.quantity }).from(orderLines).where(inArray(orderLines.orderId, mine.map((o) => o.id)))) {
      linesOf.set(l.orderId, [...(linesOf.get(l.orderId) ?? []), l]);
    }
  }

  const listed = new Set<string>();
  for (const p of ords) {
    listed.add(p.id);
    if (shipped.has(p.id)) continue;
    // One line per article: Fierro may repeat an article, miDepo adds them up.
    const qty = new Map<number, number>();
    let unknown = 0;
    for (const l of p.lines) {
      const id = productRef.get(l.bookId);
      if (id == null) unknown++;
      else qty.set(id, (qty.get(id) ?? 0) + l.quantity);
    }
    const ls = [...qty].map(([productId, quantity]) => ({ productId, quantity }));
    const existing = byFierroId.get(p.id);
    if (!existing) {
      const customerId = customerRef.get(p.customerId);
      if (!customerId || (ls.length === 0 && unknown === 0)) {
        summary.skippedOrders++;
        continue;
      }
      const [fresh] = await tx.insert(orders).values({ companyId, fierroId: p.id, number: p.number, customerId, saleMode: p.saleMode, date: p.date, unknownLines: unknown }).returning({ id: orders.id });
      if (ls.length > 0) await tx.insert(orderLines).values(ls.map((l) => ({ orderId: fresh.id, ...l })));
      summary.newOrders++;
      continue;
    }
    const same = linesKey(linesOf.get(existing.id) ?? []) === linesKey(ls) && existing.unknownLines === unknown;
    if (existing.status === "pending" || existing.status === "cancelled") {
      if (same && existing.status === "pending") continue;
      if (!same) {
        await tx.delete(orderLines).where(eq(orderLines.orderId, existing.id));
        if (ls.length > 0) await tx.insert(orderLines).values(ls.map((l) => ({ orderId: existing.id, ...l })));
      }
      await tx.update(orders).set({ status: "pending", unknownLines: unknown, fierroChange: null, saleMode: p.saleMode }).where(eq(orders.id, existing.id));
      summary.changedOrders++;
      continue;
    }
    const change = same ? null : "changed";
    if (existing.fierroChange !== change) {
      await tx.update(orders).set({ fierroChange: change }).where(eq(orders.id, existing.id));
      if (change) summary.flaggedOrders++;
    }
  }

  // An empty answer is more likely a failure on Fierro's side than every order cancelled at once.
  if (ords.length === 0) return;
  for (const o of mine) {
    if (listed.has(o.fierroId)) continue;
    if (o.status === "pending") {
      await tx.update(orders).set({ status: "cancelled", assignedTo: null }).where(eq(orders.id, o.id));
      summary.cancelledOrders++;
    } else if (o.status !== "cancelled" && o.fierroChange !== "gone") {
      await tx.update(orders).set({ fierroChange: "gone" }).where(eq(orders.id, o.id));
      summary.flaggedOrders++;
    }
  }
}
