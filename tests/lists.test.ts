import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { companies, customers, movements, orders, products, receivings, returns, suppliers, users } from "@/db/schema";
import { closeReceiving, createUnannouncedReceiving, scanReceiving } from "@/lib/flows/receiving";
import { seed } from "@/db/seed";
import { listCustomers, listMovements, listOrders, listSuppliers, receivingRows, returnRows } from "@/lib/lists";
import { markSent, pendingExports, sentExports } from "@/lib/flows/exports";

let db: DB;
let company: typeof companies.$inferSelect;
let other: number;
const all = { limit: 1000, offset: 0 };

beforeAll(async () => {
  await runMigrations();
  db = await getDb();
  await seed(db);
  const list = await db.select().from(companies).orderBy(companies.id);
  [company] = list;
  other = list[1].id;
  // The seed loads stock directly; one closed receiving gives the log movements and Fierro a document.
  const [admin] = await db.select().from(users).where(eq(users.companyId, company.id));
  const c = { db, companyId: company.id, userId: admin.id };
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.companyId, company.id)).limit(1);
  const [product] = await db.select().from(products).where(eq(products.companyId, company.id)).limit(1);
  const id = await createUnannouncedReceiving(c, supplier.id);
  await scanReceiving(c, id, product.barcode, 3);
  await closeReceiving(c, id);
});

describe("register lists", () => {
  it("lists every supplier of the company, with its receivings", async () => {
    const { total, rows } = await listSuppliers(db, company.id, "", all);
    const inDb = await db.select().from(suppliers).where(eq(suppliers.companyId, company.id));
    expect(total).toBe(inDb.length);
    const withReceivings = rows.find((r) => r.receivings > 0)!;
    expect(withReceivings).toBeDefined();
    expect((await receivingRows(db, company.id, eq(suppliers.id, withReceivings.id), all)).total).toBe(withReceivings.receivings);
    const found = await listSuppliers(db, company.id, withReceivings.name.slice(0, 4).toLowerCase(), all);
    expect(found.rows.map((r) => r.id)).toContain(withReceivings.id);
  });

  it("lists every customer, searchable by city, with counts of orders and returns", async () => {
    const { total, rows } = await listCustomers(db, company.id, "", all);
    expect(total).toBe((await db.select().from(customers).where(eq(customers.companyId, company.id))).length);
    const buyer = rows.find((r) => r.orders > 0)!;
    expect((await listOrders(db, company.id, { customerId: buyer.c.id }, all)).total).toBe(buyer.orders);
    expect((await returnRows(db, company.id, eq(returns.customerId, buyer.c.id), all)).total).toBe(buyer.returns);
    expect((await receivingRows(db, company.id, eq(receivings.status, "closed"), all, "zzz-nada")).total).toBe(0);
    if (buyer.c.city) expect((await listCustomers(db, company.id, buyer.c.city, all)).rows.map((r) => r.c.id)).toContain(buyer.c.id);
  });

  it("lists orders of every state, with a count per state", async () => {
    const r = await listOrders(db, company.id, {}, all);
    expect(r.total).toBe((await db.select().from(orders).where(eq(orders.companyId, company.id))).length);
    expect(Object.values(r.counts).reduce((a, b) => a + b, 0)).toBe(r.total);
    const pending = await listOrders(db, company.id, { status: "pending" }, all);
    expect(pending.rows.every((x) => x.o.status === "pending")).toBe(true);
    expect(pending.total).toBe(r.counts.pending);
    const one = r.rows[0];
    expect((await listOrders(db, company.id, { q: one.o.number }, all)).rows.map((x) => x.o.id)).toContain(one.o.id);
  });

  it("lists the whole movement log, filtered by reason and by what was typed", async () => {
    const r = await listMovements(db, company.id, {}, { limit: 10, offset: 0 });
    expect(r.total).toBe((await db.select().from(movements).where(eq(movements.companyId, company.id))).length);
    expect(r.rows.length).toBeLessThanOrEqual(10);
    const first = r.rows[0];
    const byReason = await listMovements(db, company.id, { reason: first.m.reason }, all);
    expect(byReason.rows.every((x) => x.m.reason === first.m.reason)).toBe(true);
    expect((await listMovements(db, company.id, { q: first.barcode }, all)).rows.every((x) => x.productId === first.productId)).toBe(true);
  });

  it("never shows another company's records", async () => {
    const theirs = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.companyId, other));
    const mine = (await listSuppliers(db, company.id, "", all)).rows.map((r) => r.id);
    expect(theirs.some((t) => mine.includes(t.id))).toBe(false);
    expect((await listOrders(db, other, {}, all)).rows.every((r) => r.o.companyId === other)).toBe(true);
  });
});

describe("documents loaded in Fierro", () => {
  it("lists what was marked as loaded, last first, and not what is still pending", async () => {
    const before = await sentExports(db, company.id, all);
    const pending = await pendingExports(db, company.id);
    expect(pending.length).toBeGreaterThan(0);
    const [admin] = await db.select().from(users).where(eq(users.companyId, company.id));
    const doc = pending[0];
    await markSent({ db, companyId: company.id, userId: admin.id }, company, doc.type, doc.id);
    const after = await sentExports(db, company.id, all);
    expect(after.total).toBe(before.total + 1);
    expect(after.rows[0]).toMatchObject({ type: doc.type, id: doc.id, number: doc.number });
    expect(after.rows[0].sent).toBeInstanceOf(Date);
    expect(after.rows.some((r) => pending.slice(1).some((p) => p.type === r.type && p.id === r.id))).toBe(false);
  });
});
