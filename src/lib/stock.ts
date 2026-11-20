import { and, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { movements, products, stock, locations, type MovementReason, type LocationType } from "@/db/schema";
import { UserError } from "./errors";
import { best, cleanScan, locationCandidates, productCandidates } from "./scan";

export type Movement = {
  companyId: number;
  productId: number;
  /** null = enters the warehouse from outside. */
  fromId: number | null;
  /** null = leaves the warehouse. */
  toId: number | null;
  quantity: number;
  reason: MovementReason;
  reference?: string;
  userId?: number | null;
};

/**
 * The single point through which physical stock changes. It always leaves a record in `movements`,
 * and never leaves a location negative.
 */
export async function moveStock(tx: Executor, m: Movement) {
  if (!Number.isInteger(m.quantity) || m.quantity <= 0) throw new UserError("STK-01", "La cantidad tiene que ser un número mayor que cero.");
  if (m.fromId != null && m.fromId === m.toId) throw new UserError("STK-02", "El origen y el destino son la misma ubicación.");

  if (m.fromId != null) {
    const rows = await tx
      .update(stock)
      .set({ quantity: sql`${stock.quantity} - ${m.quantity}` })
      .where(and(eq(stock.productId, m.productId), eq(stock.locationId, m.fromId), gte(stock.quantity, m.quantity)))
      .returning({ quantity: stock.quantity });
    if (rows.length === 0) throw new UserError("STK-03", "No hay tantas unidades de ese artículo en la ubicación de origen.");
    if (rows[0].quantity === 0) {
      await tx.delete(stock).where(and(eq(stock.productId, m.productId), eq(stock.locationId, m.fromId)));
    }
  }
  if (m.toId != null) {
    await tx
      .insert(stock)
      .values({ companyId: m.companyId, productId: m.productId, locationId: m.toId, quantity: m.quantity })
      .onConflictDoUpdate({
        target: [stock.productId, stock.locationId],
        set: { quantity: sql`${stock.quantity} + ${m.quantity}` },
      });
  }
  await tx.insert(movements).values({
    companyId: m.companyId,
    productId: m.productId,
    fromId: m.fromId,
    toId: m.toId,
    quantity: m.quantity,
    reason: m.reason,
    reference: m.reference,
    userId: m.userId ?? null,
  });
}

/**
 * The article a scan names: barcode, ISBN or SKU, after the clean-up in scan.ts (add-ons, UPC-A,
 * ISBN-10, keyboard layout). Null if none. The scan forms' live check uses the same function.
 */
export async function productByCode(tx: Executor, companyId: number, code: string) {
  const c = productCandidates(code);
  if (!c[0]) return null;
  const upper = c.map((x) => x.toUpperCase());
  const rows = await tx
    .select()
    .from(products)
    .where(and(eq(products.companyId, companyId), or(inArray(products.barcode, c), inArray(products.isbn, c), inArray(products.internalCode, upper))))
    .limit(10);
  return best(rows, [...c, ...upper], (p) => [p.barcode, p.isbn, p.internalCode]);
}

/** Looks up whatever the scanner read: barcode, ISBN or internal code. */
export async function findProduct(tx: Executor, companyId: number, code: string) {
  const c = cleanScan(code);
  if (!c) throw new UserError("STK-04", "Escanea o escribe el código del artículo.");
  const p = await productByCode(tx, companyId, c);
  if (!p) throw new UserError("STK-05", `El código "${c}" no está en el catálogo. Si es un artículo nuevo, pide que sincronicen con Fierro.`);
  return p;
}

/** The location a scan names, in capitals and with the keyboard-layout fix. Null if none. */
export async function locationByCode(tx: Executor, companyId: number, code: string) {
  const c = locationCandidates(code);
  if (!c[0]) return null;
  const rows = await tx.select().from(locations).where(and(eq(locations.companyId, companyId), inArray(locations.code, c))).limit(c.length);
  return best(rows, c, (u) => [u.code]);
}

export async function findLocation(tx: Executor, companyId: number, code: string) {
  const c = cleanScan(code).toUpperCase();
  if (!c) throw new UserError("STK-06", "Escanea o escribe la ubicación.");
  const u = await locationByCode(tx, companyId, c);
  if (!u) throw new UserError("STK-07", `No existe la ubicación "${c}".`);
  if (!u.active) throw new UserError("STK-08", `La ubicación "${u.code}" está desactivada.`);
  return u;
}

/** The special zones (receiving, returns, etc.) exist once per company. */
export const ZONES: { type: Exclude<LocationType, "shelf">; code: string; name: string }[] = [
  { type: "receiving", code: "RECEPCION", name: "Recepción" },
  { type: "returns", code: "DEVOLUCIONES", name: "Devoluciones por reponer" },
  { type: "damaged", code: "DANADOS", name: "Dañados" },
  { type: "clearance", code: "SALDOS", name: "Saldos" },
  { type: "staging", code: "PREPARACION", name: "Pedidos preparados" },
  { type: "missing", code: "FALTANTES", name: "Faltantes" },
];

export async function zone(tx: Executor, companyId: number, type: Exclude<LocationType, "shelf">) {
  const [u] = await tx
    .select()
    .from(locations)
    .where(and(eq(locations.companyId, companyId), eq(locations.type, type)))
    .limit(1);
  if (u) return u;
  const def = ZONES.find((z) => z.type === type)!;
  const [created] = await tx.insert(locations).values({ companyId, code: def.code, type }).returning();
  return created;
}

export function locationName(u: { code: string; type: LocationType; name?: string | null }) {
  return ZONES.find((z) => z.type === u.type)?.name ?? (u.type === "outside" && u.name ? u.name : u.code);
}
