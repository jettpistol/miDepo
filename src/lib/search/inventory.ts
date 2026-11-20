import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { counts, customers, locations, orders, products, receivings, returns, stock, suppliers, type OrderStatus } from "@/db/schema";
import { containsText } from "@/lib/lookup";
import { locationName } from "@/lib/stock";

/** One row of the "Inventario" tab: an article, a location or a document. */
export type InventoryHit = {
  kind: "product" | "location" | "document";
  title: string;
  /** Under the title: "Stock · Brian Azzarello", "Recepción · Ovnipress · abierta". */
  path: string[];
  href: string;
  /** At the right: units in stock, or a document's state. */
  aside?: string;
  /** What was typed is exactly its barcode, code or number (a scan): Enter opens it directly. */
  exact?: boolean;
};

const ORDER: Record<OrderStatus, { label: string; screen: "picking" | "empaque" }> = {
  pending: { label: "por preparar", screen: "picking" },
  in_picking: { label: "en picking", screen: "picking" },
  picked: { label: "por empacar", screen: "empaque" },
  packed: { label: "empacado", screen: "empaque" },
  shipped: { label: "despachado", screen: "empaque" },
};
const RECEIVING = { pending: "por recibir", in_progress: "en curso", closed: "cerrada" } as const;
const RETURN = { in_progress: "en curso", closed: "cerrada" } as const;
const COUNT = { open: "abierto", closed: "cerrado" } as const;

const units = (n: number) => (n === 1 ? "1 unidad" : `${n} unidades`);
const clean = (q: string) => q.replace(/[%_\\]/g, "");

/**
 * Articles, locations and documents matching what was typed. A supplier's or customer's name
 * finds their documents (they have no screen of their own). Scans come first.
 */
export async function searchInventory(db: DB, companyId: number, q: string): Promise<InventoryHit[]> {
  const text = clean(q.trim());
  if (text.length < 2) return [];
  const upper = text.toUpperCase();
  const c = companyId;

  const [found, places, ords, recs, rets, cnts] = await Promise.all([
    db
      .select({ id: products.id, title: products.title, author: products.author, barcode: products.barcode, isbn: products.isbn, code: products.internalCode })
      .from(products)
      .where(and(eq(products.companyId, c), or(eq(products.barcode, text), eq(products.isbn, text), eq(products.internalCode, upper), containsText(products.title, text), containsText(products.author, text))))
      .orderBy(sql`case when ${products.barcode} = ${text} or ${products.isbn} = ${text} or ${products.internalCode} = ${upper} then 0 else 1 end`, asc(products.title))
      .limit(8),
    db
      .select()
      .from(locations)
      .where(and(eq(locations.companyId, c), like(locations.code, `${upper}%`)))
      .orderBy(asc(locations.code))
      .limit(5),
    db
      .select({ id: orders.id, number: orders.number, status: orders.status, customer: customers.name })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(orders.companyId, c), or(like(sql`upper(${orders.number})`, `%${upper}%`), containsText(customers.name, text))))
      .orderBy(desc(orders.date))
      .limit(5),
    db
      .select({ id: receivings.id, number: receivings.number, status: receivings.status, supplier: suppliers.name })
      .from(receivings)
      .innerJoin(suppliers, eq(suppliers.id, receivings.supplierId))
      .where(and(eq(receivings.companyId, c), or(like(sql`upper(${receivings.number})`, `%${upper}%`), containsText(suppliers.name, text))))
      .orderBy(desc(receivings.date))
      .limit(5),
    db
      .select({ id: returns.id, number: returns.number, status: returns.status, customer: customers.name })
      .from(returns)
      .innerJoin(customers, eq(customers.id, returns.customerId))
      .where(and(eq(returns.companyId, c), or(like(sql`upper(${returns.number})`, `%${upper}%`), containsText(customers.name, text))))
      .orderBy(desc(returns.date))
      .limit(5),
    db
      .select({ id: counts.id, name: counts.name, status: counts.status })
      .from(counts)
      .where(and(eq(counts.companyId, c), containsText(counts.name, text)))
      .orderBy(desc(counts.date))
      .limit(3),
  ]);

  const totals = new Map<number, number>();
  if (found.length > 0) {
    const sums = await db
      .select({ productId: stock.productId, n: sql<number>`sum(${stock.quantity})`.mapWith(Number) })
      .from(stock)
      .where(inArray(stock.productId, found.map((p) => p.id)))
      .groupBy(stock.productId);
    for (const s of sums) totals.set(s.productId, s.n);
  }

  const onShelf = new Map<number, number>();
  if (places.length > 0) {
    const sums = await db
      .select({ locationId: stock.locationId, n: sql<number>`sum(${stock.quantity})`.mapWith(Number) })
      .from(stock)
      .where(inArray(stock.locationId, places.map((l) => l.id)))
      .groupBy(stock.locationId);
    for (const s of sums) onShelf.set(s.locationId, s.n);
  }

  const hits: InventoryHit[] = [
    ...found.map((p) => ({
      kind: "product" as const,
      title: p.title,
      path: ["Stock", p.author ?? p.barcode],
      href: `/stock/${p.id}`,
      aside: units(totals.get(p.id) ?? 0),
      exact: p.barcode === text || p.isbn === text || p.code === upper,
    })),
    ...places.map((l) => ({
      kind: "location" as const,
      title: l.code,
      // The shelf mark says it is a location; only a zone's name is worth adding.
      path: locationName(l) !== l.code ? [locationName(l)] : [],
      href: `/ubicaciones/${l.id}`,
      aside: units(onShelf.get(l.id) ?? 0),
      exact: l.code === upper,
    })),
    ...ords.map((o) => ({
      kind: "document" as const,
      title: `Pedido ${o.number}`,
      path: [ORDER[o.status].screen === "picking" ? "Picking" : "Empaque", o.customer],
      href: `/${ORDER[o.status].screen}/${o.id}`,
      aside: ORDER[o.status].label,
      exact: o.number.toUpperCase() === upper,
    })),
    ...recs.map((r) => ({
      kind: "document" as const,
      title: `Recepción ${r.number}`,
      path: ["Recepción", r.supplier],
      href: `/recepcion/${r.id}`,
      aside: RECEIVING[r.status],
      exact: r.number.toUpperCase() === upper,
    })),
    ...rets.map((r) => ({
      kind: "document" as const,
      title: `Devolución ${r.number}`,
      path: ["Devoluciones", r.customer],
      href: `/devoluciones/${r.id}`,
      aside: RETURN[r.status],
      exact: r.number.toUpperCase() === upper,
    })),
    ...cnts.map((k) => ({
      kind: "document" as const,
      title: k.name,
      path: ["Conteos"],
      href: `/conteos/${k.id}`,
      aside: COUNT[k.status],
    })),
  ];
  // A scan matches one thing exactly: it goes first, so Enter opens it.
  return [...hits.filter((h) => h.exact), ...hits.filter((h) => !h.exact)];
}
