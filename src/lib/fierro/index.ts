import { eq, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { customers, companies, fierroStock, orderLines, orders, products, receivingLines, receivings, suppliers } from "@/db/schema";
import { SimulatedFierro } from "./simulated";
import type { FierroConnector } from "./types";

export type Company = typeof companies.$inferSelect;

/** When the real connector exists, it is chosen here from the company's configuration. */
export function connector(db: Executor, company: Company): FierroConnector {
  return new SimulatedFierro(db, company);
}

const inBatches = <T,>(list: T[], n = 400) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/**
 * Brings catalogue, customers, orders and expected receipts from Fierro. Fierro rules: what
 * changed there overwrites what is here. The only thing miDepo leaves alone is orders already started.
 */
export async function sync(db: DB, company: Company) {
  const fierro = connector(db, company);
  const [books, custs, ords, rcpts] = await Promise.all([fierro.books(), fierro.customers(), fierro.pendingOrders(), fierro.expectedReceipts()]);
  // Read before the transaction opens: inside it only `tx` may be used.
  const fierroQty = await fierro.stock();
  const summary = { titles: books.length, customers: custs.length, newOrders: 0, newReceipts: 0 };

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

    const existingOrders = new Set((await tx.select({ f: orders.fierroId }).from(orders).where(eq(orders.companyId, company.id))).map((p) => p.f));
    for (const p of ords) {
      if (existingOrders.has(p.id)) continue;
      const customerId = customerRef.get(p.customerId);
      const ls = p.lines.flatMap((l) => (productRef.has(l.bookId) ? [{ productId: productRef.get(l.bookId)!, quantity: l.quantity }] : []));
      if (!customerId || ls.length === 0) continue;
      const [fresh] = await tx.insert(orders).values({ companyId: company.id, fierroId: p.id, number: p.number, customerId, saleMode: p.saleMode, date: p.date }).returning({ id: orders.id });
      await tx.insert(orderLines).values(ls.map((l) => ({ orderId: fresh.id, ...l })));
      summary.newOrders++;
    }

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
  return summary;
}

