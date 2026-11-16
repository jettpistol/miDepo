import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import type { Ejecutor } from "@/db";
import { conteoLineas, conteoUbicaciones, conteos, productos, stock, ubicaciones } from "@/db/schema";
import { ErrorUsuario } from "../errores";
import { buscarProducto, moverStock } from "../stock";
import { cantidadValida, type Ctx } from "./comun";

export const MAXIMO_CONTEO = 300;

/** Crea un conteo para todas las estanterías cuyo código empieza con el prefijo dado. */
export async function crearConteo(c: Ctx, nombre: string, prefijo: string) {
  const pre = prefijo.trim().toUpperCase();
  if (!nombre.trim()) throw new ErrorUsuario("Ponele un nombre al conteo (por ejemplo: Pasillo A, noviembre).");
  if (!pre) throw new ErrorUsuario("Escribí con qué empiezan las ubicaciones a contar (por ejemplo: A-01).");
  const us = await c.db
    .select({ id: ubicaciones.id })
    .from(ubicaciones)
    .where(and(eq(ubicaciones.empresaId, c.empresaId), eq(ubicaciones.tipo, "estanteria"), eq(ubicaciones.activa, true), like(ubicaciones.codigo, `${pre.replace(/[%_]/g, "")}%`)))
    .orderBy(asc(ubicaciones.codigo))
    .limit(MAXIMO_CONTEO + 1);
  if (us.length === 0) throw new ErrorUsuario(`No hay ubicaciones que empiecen con "${pre}".`);
  if (us.length > MAXIMO_CONTEO) throw new ErrorUsuario(`Son más de ${MAXIMO_CONTEO} ubicaciones. Partí el conteo en tramos más chicos.`);
  return c.db.transaction(async (tx) => {
    const [conteo] = await tx.insert(conteos).values({ empresaId: c.empresaId, nombre: nombre.trim() }).returning();
    await tx.insert(conteoUbicaciones).values(us.map((u) => ({ conteoId: conteo.id, ubicacionId: u.id })));
    return conteo.id;
  });
}

async function abierto(c: Ctx, conteoId: number) {
  const [k] = await c.db.select().from(conteos).where(and(eq(conteos.id, conteoId), eq(conteos.empresaId, c.empresaId)));
  if (!k) throw new ErrorUsuario("No encuentro ese conteo.");
  if (k.estado === "cerrado") throw new ErrorUsuario("Este conteo ya está cerrado.");
  return k;
}

async function ubicacionDelConteo(c: Ctx, conteoId: number, ubicacionId: number) {
  const [u] = await c.db.select().from(conteoUbicaciones).where(and(eq(conteoUbicaciones.conteoId, conteoId), eq(conteoUbicaciones.ubicacionId, ubicacionId)));
  if (!u) throw new ErrorUsuario("Esa ubicación no es parte de este conteo.");
  return u;
}

/** Conteo a ciegas: el operario no ve lo que dice el sistema, solo suma lo que encuentra. */
export async function escanearConteo(c: Ctx, conteoId: number, ubicacionId: number, codigo: string, cantidad: unknown) {
  const n = cantidadValida(cantidad);
  await abierto(c, conteoId);
  const u = await ubicacionDelConteo(c, conteoId, ubicacionId);
  if (u.estado === "contada") throw new ErrorUsuario("Esta ubicación ya se dio por contada.");
  const p = await buscarProducto(c.db, c.empresaId, codigo);
  const [l] = await c.db
    .insert(conteoLineas)
    .values({ conteoId, ubicacionId, productoId: p.id, contado: n })
    .onConflictDoUpdate({ target: [conteoLineas.conteoId, conteoLineas.ubicacionId, conteoLineas.productoId], set: { contado: sql`${conteoLineas.contado} + ${n}` } })
    .returning();
  return `${p.titulo}: llevás ${l.contado}`;
}

export async function fijarContado(c: Ctx, conteoId: number, ubicacionId: number, productoId: number, contado: unknown) {
  const n = Number(contado);
  if (!Number.isInteger(n) || n < 0) throw new ErrorUsuario("Escribí un número de cero para arriba.");
  await abierto(c, conteoId);
  await c.db.update(conteoLineas).set({ contado: n }).where(and(eq(conteoLineas.conteoId, conteoId), eq(conteoLineas.ubicacionId, ubicacionId), eq(conteoLineas.productoId, productoId)));
  return "Cantidad corregida.";
}

export async function marcarUbicacion(c: Ctx, conteoId: number, ubicacionId: number, contada: boolean) {
  await abierto(c, conteoId);
  await ubicacionDelConteo(c, conteoId, ubicacionId);
  await c.db
    .update(conteoUbicaciones)
    .set({ estado: contada ? "contada" : "pendiente", contadoPor: contada ? c.usuarioId : null })
    .where(and(eq(conteoUbicaciones.conteoId, conteoId), eq(conteoUbicaciones.ubicacionId, ubicacionId)));
  return contada ? "Ubicación contada." : "Ubicación reabierta.";
}

export type Diferencia = { ubicacionId: number; ubicacion: string; productoId: number; titulo: string; codigo: string; sistema: number; contado: number };

/** Compara lo contado con el stock, solo en las ubicaciones ya dadas por contadas. */
export async function diferencias(db: Ejecutor, conteoId: number): Promise<Diferencia[]> {
  const contadas = (await db.select({ id: conteoUbicaciones.ubicacionId }).from(conteoUbicaciones).where(and(eq(conteoUbicaciones.conteoId, conteoId), eq(conteoUbicaciones.estado, "contada")))).map((u) => u.id);
  if (contadas.length === 0) return [];
  const enSistema = await db.select().from(stock).where(inArray(stock.ubicacionId, contadas));
  const contado = await db.select().from(conteoLineas).where(and(eq(conteoLineas.conteoId, conteoId), inArray(conteoLineas.ubicacionId, contadas)));
  const mapa = new Map<string, { ubicacionId: number; productoId: number; sistema: number; contado: number }>();
  for (const s of enSistema) mapa.set(`${s.ubicacionId}:${s.productoId}`, { ubicacionId: s.ubicacionId, productoId: s.productoId, sistema: s.cantidad, contado: 0 });
  for (const l of contado) {
    const k = `${l.ubicacionId}:${l.productoId}`;
    mapa.set(k, { ubicacionId: l.ubicacionId, productoId: l.productoId, sistema: mapa.get(k)?.sistema ?? 0, contado: l.contado });
  }
  const filas = [...mapa.values()];
  if (filas.length === 0) return [];
  const us = new Map((await db.select({ id: ubicaciones.id, codigo: ubicaciones.codigo }).from(ubicaciones).where(inArray(ubicaciones.id, contadas))).map((u) => [u.id, u.codigo]));
  const ps = new Map(
    (await db.select({ id: productos.id, titulo: productos.titulo, isbn: productos.isbn, interno: productos.codigoInterno }).from(productos).where(inArray(productos.id, [...new Set(filas.map((f) => f.productoId))]))).map((p) => [p.id, p]),
  );
  return filas
    .map((f) => ({ ...f, ubicacion: us.get(f.ubicacionId) ?? "?", titulo: ps.get(f.productoId)?.titulo ?? "?", codigo: ps.get(f.productoId)?.isbn ?? ps.get(f.productoId)?.interno ?? "" }))
    .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion) || a.titulo.localeCompare(b.titulo));
}

/** El supervisor aprueba: el stock de las ubicaciones contadas pasa a ser lo contado. */
export async function cerrarConteo(c: Ctx, conteoId: number) {
  const k = await abierto(c, conteoId);
  return c.db.transaction(async (tx) => {
    const difs = await diferencias(tx, conteoId);
    const [contada] = await tx.select().from(conteoUbicaciones).where(and(eq(conteoUbicaciones.conteoId, conteoId), eq(conteoUbicaciones.estado, "contada"))).limit(1);
    if (!contada) throw new ErrorUsuario("Todavía no hay ninguna ubicación contada.");
    let ajustes = 0;
    for (const d of difs) {
      await tx
        .insert(conteoLineas)
        .values({ conteoId, ubicacionId: d.ubicacionId, productoId: d.productoId, contado: d.contado, sistema: d.sistema })
        .onConflictDoUpdate({ target: [conteoLineas.conteoId, conteoLineas.ubicacionId, conteoLineas.productoId], set: { sistema: d.sistema } });
      const delta = d.contado - d.sistema;
      if (delta === 0) continue;
      ajustes++;
      await moverStock(tx, { empresaId: c.empresaId, productoId: d.productoId, desdeId: delta < 0 ? d.ubicacionId : null, haciaId: delta > 0 ? d.ubicacionId : null, cantidad: Math.abs(delta), motivo: "ajuste_conteo", referencia: k.nombre, usuarioId: c.usuarioId });
    }
    // Las ubicaciones que quedaron sin contar se sacan del conteo: no se ajustan.
    await tx.delete(conteoUbicaciones).where(and(eq(conteoUbicaciones.conteoId, conteoId), eq(conteoUbicaciones.estado, "pendiente")));
    await tx.update(conteos).set({ estado: "cerrado" }).where(eq(conteos.id, conteoId));
    return ajustes === 0 ? "Conteo cerrado. Todo coincidía." : `Conteo cerrado con ${ajustes} ajuste${ajustes === 1 ? "" : "s"} de stock.`;
  });
}
