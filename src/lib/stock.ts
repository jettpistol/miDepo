import { and, eq, gte, or, sql } from "drizzle-orm";
import type { Ejecutor } from "@/db";
import { movimientos, productos, stock, ubicaciones, type MotivoMovimiento, type TipoUbicacion } from "@/db/schema";
import { ErrorUsuario } from "./errores";

export type Movimiento = {
  empresaId: number;
  productoId: number;
  /** null = entra al depósito desde afuera. */
  desdeId: number | null;
  /** null = sale del depósito. */
  haciaId: number | null;
  cantidad: number;
  motivo: MotivoMovimiento;
  referencia?: string;
  usuarioId?: number | null;
};

/**
 * Único punto por el que cambia el stock físico. Siempre deja registro en `movimientos`,
 * y nunca deja una ubicación en negativo.
 */
export async function moverStock(tx: Ejecutor, m: Movimiento) {
  if (!Number.isInteger(m.cantidad) || m.cantidad <= 0) throw new ErrorUsuario("La cantidad tiene que ser un número mayor que cero.");
  if (m.desdeId != null && m.desdeId === m.haciaId) throw new ErrorUsuario("El origen y el destino son la misma ubicación.");

  if (m.desdeId != null) {
    const filas = await tx
      .update(stock)
      .set({ cantidad: sql`${stock.cantidad} - ${m.cantidad}` })
      .where(and(eq(stock.productoId, m.productoId), eq(stock.ubicacionId, m.desdeId), gte(stock.cantidad, m.cantidad)))
      .returning({ cantidad: stock.cantidad });
    if (filas.length === 0) throw new ErrorUsuario("No hay tantas unidades de ese título en la ubicación de origen.");
    if (filas[0].cantidad === 0) {
      await tx.delete(stock).where(and(eq(stock.productoId, m.productoId), eq(stock.ubicacionId, m.desdeId)));
    }
  }
  if (m.haciaId != null) {
    await tx
      .insert(stock)
      .values({ empresaId: m.empresaId, productoId: m.productoId, ubicacionId: m.haciaId, cantidad: m.cantidad })
      .onConflictDoUpdate({
        target: [stock.productoId, stock.ubicacionId],
        set: { cantidad: sql`${stock.cantidad} + ${m.cantidad}` },
      });
  }
  await tx.insert(movimientos).values({
    empresaId: m.empresaId,
    productoId: m.productoId,
    desdeId: m.desdeId,
    haciaId: m.haciaId,
    cantidad: m.cantidad,
    motivo: m.motivo,
    referencia: m.referencia,
    usuarioId: m.usuarioId ?? null,
  });
}

/** Busca por lo que haya leído el lector: código de barras, ISBN o código interno. */
export async function buscarProducto(tx: Ejecutor, empresaId: number, codigo: string) {
  const c = codigo.trim();
  if (!c) throw new ErrorUsuario("Escaneá o escribí el código del libro.");
  const [p] = await tx
    .select()
    .from(productos)
    .where(
      and(
        eq(productos.empresaId, empresaId),
        or(eq(productos.codigoBarras, c), eq(productos.isbn, c), eq(productos.codigoInterno, c.toUpperCase())),
      ),
    )
    .limit(1);
  if (!p) throw new ErrorUsuario(`No conozco el código "${c}". Si es un título nuevo, pedí que sincronicen con Fierro.`);
  return p;
}

export async function buscarUbicacion(tx: Ejecutor, empresaId: number, codigo: string) {
  const c = codigo.trim().toUpperCase();
  if (!c) throw new ErrorUsuario("Escaneá o escribí la ubicación.");
  const [u] = await tx
    .select()
    .from(ubicaciones)
    .where(and(eq(ubicaciones.empresaId, empresaId), eq(ubicaciones.codigo, c)))
    .limit(1);
  if (!u) throw new ErrorUsuario(`No existe la ubicación "${c}".`);
  if (!u.activa) throw new ErrorUsuario(`La ubicación "${c}" está dada de baja.`);
  return u;
}

/** Las zonas especiales (recepción, devoluciones, etc.) existen una sola vez por empresa. */
export const ZONAS: { tipo: Exclude<TipoUbicacion, "estanteria">; codigo: string; nombre: string }[] = [
  { tipo: "recepcion", codigo: "RECEPCION", nombre: "Recepción" },
  { tipo: "devoluciones", codigo: "DEVOLUCIONES", nombre: "Devoluciones por guardar" },
  { tipo: "danados", codigo: "DANADOS", nombre: "Dañados" },
  { tipo: "saldos", codigo: "SALDOS", nombre: "Saldos" },
  { tipo: "preparacion", codigo: "PREPARACION", nombre: "Pedidos preparados" },
];

export async function zona(tx: Ejecutor, empresaId: number, tipo: Exclude<TipoUbicacion, "estanteria">) {
  const [u] = await tx
    .select()
    .from(ubicaciones)
    .where(and(eq(ubicaciones.empresaId, empresaId), eq(ubicaciones.tipo, tipo)))
    .limit(1);
  if (u) return u;
  const def = ZONAS.find((z) => z.tipo === tipo)!;
  const [nueva] = await tx.insert(ubicaciones).values({ empresaId, codigo: def.codigo, tipo }).returning();
  return nueva;
}

export function nombreUbicacion(u: { codigo: string; tipo: TipoUbicacion }) {
  return ZONAS.find((z) => z.tipo === u.tipo)?.nombre ?? u.codigo;
}
