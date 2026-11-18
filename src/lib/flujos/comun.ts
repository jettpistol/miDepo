import { eq, and } from "drizzle-orm";
import type { DB } from "@/db";
import { clavesUnaVez, erroresEscaneo } from "@/db/schema";
import { ErrorUsuario } from "../errores";

/**
 * `clave` es opcional: cuando viene (los formularios de escaneo la mandan), la operación se
 * aplica una sola vez aunque llegue repetida. Ver `unaVez`.
 */
export type Ctx = { db: DB; empresaId: number; usuarioId: number; clave?: string };

export function cantidadValida(v: unknown, mensaje = "La cantidad tiene que ser un número entero mayor que cero.") {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 100000) throw new ErrorUsuario(mensaje);
  return n;
}

/**
 * Ejecuta `fn` dentro de una transacción y, si el contexto trae una clave, garantiza que una
 * misma clave se aplique una sola vez: un doble toque o un reintento por mala señal devuelve el
 * mensaje de la primera vez sin volver a sumar. Si `fn` falla, la clave no queda usada.
 *
 * Adentro de `fn` hay que usar solo `cx.db` (la transacción): con la base embebida, una consulta
 * por fuera de la transacción queda esperando a que esta termine.
 */
export async function unaVez(c: Ctx, fn: (cx: Ctx) => Promise<string>): Promise<string> {
  return c.db.transaction(async (tx) => {
    const cx: Ctx = { ...c, db: tx as unknown as DB };
    const { clave } = c;
    if (clave) {
      const nueva = await tx.insert(clavesUnaVez).values({ empresaId: c.empresaId, clave }).onConflictDoNothing().returning({ clave: clavesUnaVez.clave });
      if (nueva.length === 0) {
        // Si la primera todavía no terminó, el insert de arriba esperó a que lo hiciera.
        const [previa] = await tx.select({ resultado: clavesUnaVez.resultado }).from(clavesUnaVez).where(and(eq(clavesUnaVez.empresaId, c.empresaId), eq(clavesUnaVez.clave, clave)));
        return previa?.resultado ?? "Ya estaba registrado.";
      }
    }
    const mensaje = await fn(cx);
    if (clave) await tx.update(clavesUnaVez).set({ resultado: mensaje }).where(and(eq(clavesUnaVez.empresaId, c.empresaId), eq(clavesUnaVez.clave, clave)));
    return mensaje;
  });
}

/** Deja constancia de un escaneo rechazado. Nunca hace fallar la operación que lo origina. */
export async function registrarErrorEscaneo(db: DB, d: { empresaId: number; usuarioId: number; flujo: string; error: ErrorUsuario; detalle?: Record<string, string> }) {
  try {
    await db.insert(erroresEscaneo).values({ empresaId: d.empresaId, usuarioId: d.usuarioId, flujo: d.flujo, tipo: d.error.tipo, mensaje: d.error.message, detalle: d.detalle ?? null });
  } catch (e) {
    console.error("No se pudo registrar el error de escaneo", e);
  }
}
