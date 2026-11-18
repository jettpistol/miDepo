import { and, eq, gte, or, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { movements, products, stock, locations, type MovementReason, type LocationType } from "@/db/schema";
import { UserError } from "./errors";

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
  if (!Number.isInteger(m.quantity) || m.quantity <= 0) throw new UserError("La cantidad tiene que ser un número mayor que cero.");
  if (m.fromId != null && m.fromId === m.toId) throw new UserError("El origen y el destino son la misma ubicación.");

  if (m.fromId != null) {
    const rows = await tx
      .update(stock)
      .set({ quantity: sql`${stock.quantity} - ${m.quantity}` })
      .where(and(eq(stock.productId, m.productId), eq(stock.locationId, m.fromId), gte(stock.quantity, m.quantity)))
      .returning({ quantity: stock.quantity });
    if (rows.length === 0) throw new UserError("No hay tantas unidades de ese título en la ubicación de origen.");
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

/** Looks up whatever the scanner read: barcode, ISBN or internal code. */
export async function findProduct(tx: Executor, companyId: number, code: string) {
  const c = code.trim();
  if (!c) throw new UserError("Escaneá o escribí el código del libro.");
  const [p] = await tx
    .select()
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        or(eq(products.barcode, c), eq(products.isbn, c), eq(products.internalCode, c.toUpperCase())),
      ),
    )
    .limit(1);
  if (!p) throw new UserError(`No conozco el código "${c}". Si es un título nuevo, pedí que sincronicen con Fierro.`);
  return p;
}

export async function findLocation(tx: Executor, companyId: number, code: string) {
  const c = code.trim().toUpperCase();
  if (!c) throw new UserError("Escaneá o escribí la ubicación.");
  const [u] = await tx
    .select()
    .from(locations)
    .where(and(eq(locations.companyId, companyId), eq(locations.code, c)))
    .limit(1);
  if (!u) throw new UserError(`No existe la ubicación "${c}".`);
  if (!u.active) throw new UserError(`La ubicación "${c}" está dada de baja.`);
  return u;
}

/** The special zones (receiving, returns, etc.) exist once per company. */
export const ZONES: { type: Exclude<LocationType, "shelf">; code: string; name: string }[] = [
  { type: "receiving", code: "RECEPCION", name: "Recepción" },
  { type: "returns", code: "DEVOLUCIONES", name: "Devoluciones por guardar" },
  { type: "damaged", code: "DANADOS", name: "Dañados" },
  { type: "clearance", code: "SALDOS", name: "Saldos" },
  { type: "staging", code: "PREPARACION", name: "Pedidos preparados" },
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

export function locationName(u: { code: string; type: LocationType }) {
  return ZONES.find((z) => z.type === u.type)?.name ?? u.code;
}
