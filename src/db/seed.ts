import { eq, sql } from "drizzle-orm";
import type { DB } from "./index";
import { companies, fierroStock, products, stock, locations, users, type Role } from "./schema";
import ovnipressCatalog from "@/lib/fierro/ovnipress-catalog.json";
import { hashPassword, pinHmac } from "@/lib/credentials";
import { sync } from "@/lib/fierro";
import { initialStock } from "@/lib/fierro/simulated";
import { ZONES } from "@/lib/stock";
import { generateCodes, TEMPLATES, type Scheme } from "@/lib/locations";

export const DEMO_PASSWORD = "midepo1234";

type Demo = {
  name: string;
  slug: string;
  seedNum: number;
  titles: number;
  customers: number;
  orders: number;
  receipts: number;
  scheme: Scheme;
  /** How many titles share one location. */
  perLocation: number;
  users: { name: string; email: string; role: Role; pin?: string; accent?: string }[];
};

const DEMOS: Demo[] = [
  {
    name: "Ovnipress",
    slug: "ovnipress",
    seedNum: 7,
    titles: ovnipressCatalog.length, // only the real scraped titles: a small catalogue is enough for testing
    customers: 300,
    orders: 80,
    receipts: 6,
    scheme: TEMPLATES[0].scheme,
    perLocation: 8,
    users: [
      { name: "Admin Ovnipress", email: "admin@ovnipress.test", role: "admin" },
      { name: "Sofía Quiroga", email: "supervisor@ovnipress.test", role: "supervisor", pin: "100000" },
      ...["Martín Sosa", "Lucía Ferreyra", "Joaquín Paz", "Camila Ortiz", "Nicolás Rivas", "Julieta Ibarra", "Facundo Varela", "Mara Ledesma"].map(
        (name, i) => ({ name, email: `operario${i + 1}@ovnipress.test`, role: "operator" as Role, pin: String(100001 + i) }),
      ),
    ],
  },
  {
    name: "Librería Demo",
    slug: "demo",
    seedNum: 21,
    titles: 450,
    customers: 40,
    orders: 12,
    receipts: 2,
    scheme: TEMPLATES[1].scheme,
    perLocation: 4,
    users: [
      { name: "Admin Demo", email: "admin@demo.test", role: "admin", accent: "#0F766E" },
      { name: "Operario Demo", email: "operario@demo.test", role: "operator", pin: "200001", accent: "#0F766E" },
    ],
  },
];

export async function createCompany(db: DB, data: { name: string; slug: string; scheme?: Scheme }) {
  const [company] = await db.insert(companies).values({ name: data.name, slug: data.slug, locationScheme: data.scheme ?? null }).returning();
  await db.insert(locations).values(ZONES.map((z) => ({ companyId: company.id, code: z.code, type: z.type })));
  return company;
}

export async function createUser(db: DB, companyId: number, u: { name: string; email: string; role: Role; password?: string; pin?: string; accent?: string }) {
  const [fresh] = await db
    .insert(users)
    .values({
      companyId,
      name: u.name,
      email: u.email.toLowerCase().trim(),
      role: u.role,
      passwordHash: u.password ? hashPassword(u.password) : null,
      pinHmac: u.pin ? pinHmac(companyId, u.pin) : null,
      ...(u.accent ? { accent: u.accent } : {}),
    })
    .returning();
  return fresh;
}

const batches = <T,>(l: T[], n: number) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));

export async function seed(db: DB, log: (m: string) => void = () => {}) {
  for (const d of DEMOS) {
    log(`Creating ${d.name}: ${d.titles} titles, ${d.orders} orders…`);
    const base = await createCompany(db, d);
    const [company] = await db
      .update(companies)
      .set({ simSeed: d.seedNum, simTitles: d.titles, simCustomers: d.customers, simOrders: d.orders, simReceipts: d.receipts })
      .where(eq(companies.id, base.id))
      .returning();
    for (const u of d.users) await createUser(db, company.id, { ...u, password: DEMO_PASSWORD });

    const codes = generateCodes(d.scheme);
    for (const t of batches(codes, 1000)) await db.insert(locations).values(t.map((code) => ({ companyId: company.id, code })));
    const shelves = (await db.select({ id: locations.id, code: locations.code }).from(locations).where(eq(locations.companyId, company.id)))
      .filter((u) => codes.includes(u.code))
      .sort((a, b) => codes.indexOf(a.code) - codes.indexOf(b.code));

    await sync(db, company);
    const prods = (await db.select({ id: products.id, fierroId: products.fierroId }).from(products).where(eq(products.companyId, company.id)))
      .map((p) => ({ id: p.id, i: Number(p.fierroId.split("-L")[1]) - 1 }))
      .sort((a, b) => a.i - b.i);

    // Initial physical stock: series stay together; what does not fit goes to a second place.
    const stockRows: (typeof stock.$inferInsert)[] = [];
    const fierroRows: (typeof fierroStock.$inferInsert)[] = [];
    for (const p of prods) {
      const q = initialStock(d.seedNum, p.i);
      // Fierro starts almost equal to the warehouse: 1 title in 70 differs, so the reconciliation has something to show.
      const deviation = p.i % 70 === 13 ? (p.i % 3) - 1 || 2 : 0;
      fierroRows.push({ companyId: company.id, productId: p.id, quantity: Math.max(0, q + deviation) });
      if (q === 0) continue;
      const primary = shelves[Math.floor(p.i / d.perLocation) % shelves.length];
      const inMain = Math.min(q, 60);
      stockRows.push({ companyId: company.id, productId: p.id, locationId: primary.id, quantity: inMain });
      if (q > inMain) {
        const reserve = shelves[(Math.floor(p.i / d.perLocation) + Math.floor(shelves.length / 2) + 3) % shelves.length];
        stockRows.push({ companyId: company.id, productId: p.id, locationId: reserve.id, quantity: q - inMain });
      }
    }
    for (const t of batches(stockRows, 1000)) await db.insert(stock).values(t);
    for (const t of batches(fierroRows, 1000)) {
      await db.insert(fierroStock).values(t).onConflictDoUpdate({ target: [fierroStock.companyId, fierroStock.productId], set: { quantity: sql`excluded.quantity` } });
    }
  }
}
