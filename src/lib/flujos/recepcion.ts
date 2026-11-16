import { and, count, eq, sql } from "drizzle-orm";
import { recepcionLineas, recepciones } from "@/db/schema";
import { ErrorUsuario } from "../errores";
import { buscarProducto, moverStock, zona } from "../stock";
import { cantidadValida, type Ctx } from "./comun";

async function abierta(c: Ctx, id: number) {
  const [r] = await c.db.select().from(recepciones).where(and(eq(recepciones.id, id), eq(recepciones.empresaId, c.empresaId)));
  if (!r) throw new ErrorUsuario("No encuentro esa recepción.");
  if (r.estado === "cerrada") throw new ErrorUsuario("Esta recepción ya está cerrada.");
  return r;
}

export async function crearRecepcionSinAviso(c: Ctx, proveedor: string) {
  const nombre = proveedor.trim();
  if (!nombre) throw new ErrorUsuario("Escribí de dónde viene la mercadería (imprenta, proveedor, feria…).");
  const [{ n }] = await c.db.select({ n: count() }).from(recepciones).where(and(eq(recepciones.empresaId, c.empresaId), sql`${recepciones.fierroId} is null`));
  const [r] = await c.db
    .insert(recepciones)
    .values({ empresaId: c.empresaId, numero: `REC-${String(n + 1).padStart(4, "0")}`, proveedor: nombre, estado: "en_curso" })
    .returning();
  return r.id;
}

/** Suma unidades recibidas de un título. Si el título no estaba en el aviso, lo agrega igual. */
export async function escanearRecepcion(c: Ctx, recepcionId: number, codigo: string, cantidad: unknown) {
  const n = cantidadValida(cantidad);
  const r = await abierta(c, recepcionId);
  const p = await buscarProducto(c.db, c.empresaId, codigo);
  const [linea] = await c.db
    .insert(recepcionLineas)
    .values({ recepcionId, productoId: p.id, esperado: 0, recibido: n })
    .onConflictDoUpdate({ target: [recepcionLineas.recepcionId, recepcionLineas.productoId], set: { recibido: sql`${recepcionLineas.recibido} + ${n}` } })
    .returning();
  if (r.estado === "pendiente") await c.db.update(recepciones).set({ estado: "en_curso" }).where(eq(recepciones.id, recepcionId));
  const aviso = linea.esperado === 0 ? " (no estaba en el aviso)" : linea.recibido > linea.esperado ? ` (¡van ${linea.recibido - linea.esperado} de más!)` : "";
  return `${p.titulo}: ${linea.recibido} de ${linea.esperado}${aviso}`;
}

export async function fijarRecibido(c: Ctx, recepcionId: number, productoId: number, recibido: unknown) {
  const n = Number(recibido);
  if (!Number.isInteger(n) || n < 0) throw new ErrorUsuario("Escribí un número de cero para arriba.");
  await abierta(c, recepcionId);
  await c.db.update(recepcionLineas).set({ recibido: n }).where(and(eq(recepcionLineas.recepcionId, recepcionId), eq(recepcionLineas.productoId, productoId)));
  return "Cantidad corregida.";
}

/** Cierra la recepción: lo recibido entra al stock en la zona de Recepción, listo para guardar. */
export async function cerrarRecepcion(c: Ctx, recepcionId: number) {
  const r = await abierta(c, recepcionId);
  return c.db.transaction(async (tx) => {
    const lineas = await tx.select().from(recepcionLineas).where(eq(recepcionLineas.recepcionId, recepcionId));
    const total = lineas.reduce((s, l) => s + l.recibido, 0);
    if (total === 0) throw new ErrorUsuario("Todavía no escaneaste nada en esta recepción.");
    const destino = await zona(tx, c.empresaId, "recepcion");
    for (const l of lineas) {
      if (l.recibido > 0) {
        await moverStock(tx, { empresaId: c.empresaId, productoId: l.productoId, desdeId: null, haciaId: destino.id, cantidad: l.recibido, motivo: "recepcion", referencia: r.numero, usuarioId: c.usuarioId });
      }
    }
    await tx.update(recepciones).set({ estado: "cerrada" }).where(eq(recepciones.id, recepcionId));
    return `Recepción ${r.numero} cerrada: ${total} unidades esperan en Recepción para guardar.`;
  });
}
