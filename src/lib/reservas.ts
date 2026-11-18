import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Ejecutor } from "@/db";
import { comprometido, pedidoLineas, pedidos, stock, ubicaciones } from "@/db/schema";

/**
 * Reservas de stock.
 *
 *   disponible = vendible - comprometido
 *
 * - vendible: lo que hay en estanterías activas. Recepción, devoluciones por guardar, dañados,
 *   saldos y pedidos ya preparados no cuentan: no se pueden tomar del estante para un pedido.
 * - comprometido: unidades apartadas para pedidos que todavía no se tomaron del estante.
 *
 * Un pedido reserva cuando entra (o cuando aparece stock, en orden de llegada). Al tomar un libro
 * del estante, la reserva se libera en el mismo paso en que el libro sale de la estantería, así
 * `disponible` no se mueve. Lo que no se pudo reservar queda como saldo pendiente de la línea:
 * cantidad - pickeado - reservado.
 *
 * Para que dos pedidos no se queden con el último ejemplar a la vez, toda reserva primero bloquea
 * la fila del título en `comprometido` (FOR UPDATE) y recién después mira cuánto hay libre.
 * Los títulos se bloquean siempre en orden de id, para que dos procesos no se traben entre sí.
 */

/** Lo que hay en estanterías activas para un título. */
async function vendibleDe(tx: Ejecutor, empresaId: number, productoId: number) {
  const [f] = await tx
    .select({ n: sql<number>`coalesce(sum(${stock.cantidad}), 0)`.mapWith(Number) })
    .from(stock)
    .innerJoin(ubicaciones, eq(ubicaciones.id, stock.ubicacionId))
    .where(and(eq(stock.empresaId, empresaId), eq(stock.productoId, productoId), eq(ubicaciones.tipo, "estanteria"), eq(ubicaciones.activa, true)));
  return f.n;
}

/** Bloquea la fila del título (creándola si hace falta) y devuelve lo que hay comprometido. */
async function bloquear(tx: Ejecutor, empresaId: number, productoId: number) {
  await tx.insert(comprometido).values({ empresaId, productoId, cantidad: 0 }).onConflictDoNothing();
  const [f] = await tx
    .select({ cantidad: comprometido.cantidad })
    .from(comprometido)
    .where(and(eq(comprometido.empresaId, empresaId), eq(comprometido.productoId, productoId)))
    .for("update");
  return f.cantidad;
}

async function ajustarComprometido(tx: Ejecutor, empresaId: number, productoId: number, delta: number) {
  await tx
    .update(comprometido)
    .set({ cantidad: sql`${comprometido.cantidad} + ${delta}` })
    .where(and(eq(comprometido.empresaId, empresaId), eq(comprometido.productoId, productoId)));
}

/** Reserva para una línea todo lo que le falta y haya libre. Devuelve cuántas unidades apartó. */
export async function reservarLinea(tx: Ejecutor, empresaId: number, lineaId: number, productoId: number) {
  const apartado = await bloquear(tx, empresaId, productoId);
  // La línea se lee recién ahora, con el título bloqueado: nadie la puede haber cambiado en el medio.
  const [l] = await tx.select().from(pedidoLineas).where(eq(pedidoLineas.id, lineaId));
  if (!l) return 0;
  const falta = l.cantidad - l.pickeado - l.reservado;
  if (falta <= 0) return 0;
  const tomo = Math.min(falta, Math.max(0, (await vendibleDe(tx, empresaId, productoId)) - apartado));
  if (tomo <= 0) return 0;
  await ajustarComprometido(tx, empresaId, productoId, tomo);
  await tx.update(pedidoLineas).set({ reservado: sql`${pedidoLineas.reservado} + ${tomo}` }).where(eq(pedidoLineas.id, lineaId));
  return tomo;
}

/** Reserva todas las líneas de un pedido. */
export async function reservarPedido(tx: Ejecutor, empresaId: number, pedidoId: number) {
  const lineas = await tx.select({ id: pedidoLineas.id, productoId: pedidoLineas.productoId }).from(pedidoLineas).where(eq(pedidoLineas.pedidoId, pedidoId)).orderBy(asc(pedidoLineas.productoId), asc(pedidoLineas.id));
  let total = 0;
  for (const l of lineas) total += await reservarLinea(tx, empresaId, l.id, l.productoId);
  return total;
}

/**
 * Reparte stock libre entre los pedidos pendientes que quedaron con saldo, el más viejo primero.
 * Se llama cuando aparece stock vendible (guardar, mover, conteo, sincronización) y es seguro
 * llamarla de más. Solo toca pedidos pendientes: uno que ya está en picking no recibe más.
 */
export async function asignarReservas(tx: Ejecutor, empresaId: number, productoIds?: number[]) {
  if (productoIds && productoIds.length === 0) return 0;
  const filas = await tx
    .select({ id: pedidoLineas.id, productoId: pedidoLineas.productoId })
    .from(pedidoLineas)
    .innerJoin(pedidos, eq(pedidos.id, pedidoLineas.pedidoId))
    .where(
      and(
        eq(pedidos.empresaId, empresaId),
        eq(pedidos.estado, "pendiente"),
        sql`${pedidoLineas.cantidad} - ${pedidoLineas.pickeado} - ${pedidoLineas.reservado} > 0`,
        productoIds ? inArray(pedidoLineas.productoId, productoIds) : undefined,
      ),
    )
    .orderBy(asc(pedidoLineas.productoId), asc(pedidos.fecha), asc(pedidos.id), asc(pedidoLineas.id));
  let total = 0;
  for (const f of filas) total += await reservarLinea(tx, empresaId, f.id, f.productoId);
  return total;
}

/**
 * Suelta hasta `n` unidades reservadas de una línea (porque se tomaron del estante, se canceló
 * el pedido o no se encontraron). Devuelve cuántas soltó de verdad.
 */
export async function liberarReserva(tx: Ejecutor, empresaId: number, lineaId: number, n: number) {
  if (n <= 0) return 0;
  const [l] = await tx.select({ productoId: pedidoLineas.productoId, reservado: pedidoLineas.reservado }).from(pedidoLineas).where(eq(pedidoLineas.id, lineaId));
  if (!l) return 0;
  const suelto = Math.min(n, l.reservado);
  if (suelto <= 0) return 0;
  await bloquear(tx, empresaId, l.productoId);
  await tx.update(pedidoLineas).set({ reservado: sql`${pedidoLineas.reservado} - ${suelto}` }).where(eq(pedidoLineas.id, lineaId));
  await ajustarComprometido(tx, empresaId, l.productoId, -suelto);
  return suelto;
}

export type ResumenStock = { fisico: number; vendible: number; comprometido: number; disponible: number };

/**
 * Los cuatro números de cada título. `disponible` puede dar negativo: pasa si se sacó de la
 * estantería stock que ya estaba prometido (por ejemplo, un libro dañado). Es una alerta, no un error.
 */
export async function resumenStock(db: Ejecutor, empresaId: number, productoIds: number[]) {
  const mapa = new Map<number, ResumenStock>();
  if (productoIds.length === 0) return mapa;
  const filas = await db
    .select({
      productoId: stock.productoId,
      fisico: sql<number>`sum(${stock.cantidad})`.mapWith(Number),
      vendible: sql<number>`coalesce(sum(case when ${ubicaciones.tipo} = 'estanteria' and ${ubicaciones.activa} then ${stock.cantidad} else 0 end), 0)`.mapWith(Number),
    })
    .from(stock)
    .innerJoin(ubicaciones, eq(ubicaciones.id, stock.ubicacionId))
    .where(and(eq(stock.empresaId, empresaId), inArray(stock.productoId, productoIds)))
    .groupBy(stock.productoId);
  const apartados = new Map((await db.select().from(comprometido).where(and(eq(comprometido.empresaId, empresaId), inArray(comprometido.productoId, productoIds)))).map((c) => [c.productoId, c.cantidad]));
  for (const id of productoIds) {
    const f = filas.find((x) => x.productoId === id);
    const fisico = f?.fisico ?? 0;
    const vendible = f?.vendible ?? 0;
    const apartado = apartados.get(id) ?? 0;
    mapa.set(id, { fisico, vendible, comprometido: apartado, disponible: vendible - apartado });
  }
  return mapa;
}
