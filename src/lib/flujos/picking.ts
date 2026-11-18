import { and, eq, inArray, sql } from "drizzle-orm";
import type { Ejecutor } from "@/db";
import { pedidoLineas, pedidos, stock, tareasPicking, ubicaciones } from "@/db/schema";
import { ErrorUsuario } from "../errores";
import { liberarReserva, reservarPedido } from "../reservas";
import { buscarProducto, buscarUbicacion, moverStock, zona } from "../stock";
import { cantidadValida, unaVez, type Ctx } from "./comun";

async function pedidoDe(c: Ctx, id: number) {
  const [p] = await c.db.select().from(pedidos).where(and(eq(pedidos.id, id), eq(pedidos.empresaId, c.empresaId)));
  if (!p) throw new ErrorUsuario("No encuentro ese pedido.");
  return p;
}

/**
 * Stock de estantería disponible para un título: lo que hay menos lo que ya está prometido
 * a paradas pendientes de otros pedidos. Ordenado para vaciar primero los lugares con menos.
 */
async function disponible(tx: Ejecutor, empresaId: number, productoIds: number[], excluir: Set<number | null> = new Set()) {
  if (productoIds.length === 0) return new Map<number, { ubicacionId: number; libre: number }[]>();
  const filas = await tx
    .select({ productoId: stock.productoId, ubicacionId: stock.ubicacionId, cantidad: stock.cantidad })
    .from(stock)
    .innerJoin(ubicaciones, eq(ubicaciones.id, stock.ubicacionId))
    .where(and(eq(stock.empresaId, empresaId), inArray(stock.productoId, productoIds), eq(ubicaciones.tipo, "estanteria"), eq(ubicaciones.activa, true)));
  const prometido = await tx
    .select({ productoId: tareasPicking.productoId, ubicacionId: tareasPicking.ubicacionId, n: sql<number>`sum(${tareasPicking.cantidad} - ${tareasPicking.pickeado})`.mapWith(Number) })
    .from(tareasPicking)
    .where(and(inArray(tareasPicking.productoId, productoIds), eq(tareasPicking.estado, "pendiente")))
    .groupBy(tareasPicking.productoId, tareasPicking.ubicacionId);
  const reservado = new Map(prometido.map((r) => [`${r.productoId}:${r.ubicacionId}`, r.n]));
  const mapa = new Map<number, { ubicacionId: number; libre: number }[]>();
  for (const f of filas) {
    if (excluir.has(f.ubicacionId)) continue;
    const libre = f.cantidad - (reservado.get(`${f.productoId}:${f.ubicacionId}`) ?? 0);
    if (libre > 0) mapa.set(f.productoId, [...(mapa.get(f.productoId) ?? []), { ubicacionId: f.ubicacionId, libre }]);
  }
  for (const l of mapa.values()) l.sort((a, b) => a.libre - b.libre);
  return mapa;
}

/** Reparte una cantidad entre ubicaciones. Devuelve las paradas y lo que no se pudo cubrir. */
function repartir(lugares: { ubicacionId: number; libre: number }[], cantidad: number) {
  // Si un solo lugar alcanza, se va a ese y se evita una parada extra.
  const unico = lugares.find((l) => l.libre >= cantidad);
  if (unico) return { paradas: [{ ubicacionId: unico.ubicacionId, cantidad }], falta: 0 };
  const paradas: { ubicacionId: number; cantidad: number }[] = [];
  let falta = cantidad;
  for (const l of [...lugares].sort((a, b) => b.libre - a.libre)) {
    if (falta === 0) break;
    const tomo = Math.min(l.libre, falta);
    paradas.push({ ubicacionId: l.ubicacionId, cantidad: tomo });
    falta -= tomo;
  }
  return { paradas, falta };
}

/**
 * El operario toma un pedido pendiente: se arma el recorrido por las estanterías.
 * El recorrido cubre lo que el pedido tiene reservado; lo que no se pudo reservar queda como
 * faltante (saldo pendiente) y el pedido sigue con lo demás.
 */
export async function tomarPedido(c: Ctx, pedidoId: number) {
  const p = await pedidoDe(c, pedidoId);
  return c.db.transaction(async (tx) => {
    // El cambio de estado va primero y condicionado: si dos personas tocan a la vez, gana una sola.
    const tomado = await tx.update(pedidos).set({ estado: "en_preparacion", tomadoPor: c.usuarioId, tomadoEn: new Date() }).where(and(eq(pedidos.id, pedidoId), eq(pedidos.estado, "pendiente"))).returning({ id: pedidos.id });
    if (tomado.length === 0) throw new ErrorUsuario("Ese pedido ya lo tomó otra persona.");
    // Si desde que entró apareció stock, se reserva ahora lo que le faltaba.
    await reservarPedido(tx, c.empresaId, pedidoId);
    const lineas = await tx.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, pedidoId));
    const libres = await disponible(tx, c.empresaId, lineas.map((l) => l.productoId));
    const tareas: (typeof tareasPicking.$inferInsert)[] = [];
    for (const l of lineas) {
      const { paradas, falta: sinLugar } = repartir(libres.get(l.productoId) ?? [], l.reservado);
      for (const s of paradas) tareas.push({ pedidoId, lineaId: l.id, productoId: l.productoId, ubicacionId: s.ubicacionId, cantidad: s.cantidad });
      // Reservado pero sin estante donde buscarlo: el sistema y el estante no coinciden. Se suelta la reserva.
      if (sinLugar > 0) await liberarReserva(tx, c.empresaId, l.id, sinLugar);
      const falta = l.cantidad - l.pickeado - l.reservado + sinLugar;
      if (falta > 0) tareas.push({ pedidoId, lineaId: l.id, productoId: l.productoId, ubicacionId: null, cantidad: falta, estado: "faltante" });
    }
    await tx.insert(tareasPicking).values(tareas);
    await revisarFin(tx, pedidoId);
    return `Pedido ${p.numero} tomado.`;
  });
}

async function revisarFin(tx: Ejecutor, pedidoId: number) {
  const [queda] = await tx.select({ id: tareasPicking.id }).from(tareasPicking).where(and(eq(tareasPicking.pedidoId, pedidoId), eq(tareasPicking.estado, "pendiente"))).limit(1);
  if (!queda) await tx.update(pedidos).set({ estado: "preparado", preparadoEn: new Date() }).where(and(eq(pedidos.id, pedidoId), eq(pedidos.estado, "en_preparacion")));
  return !queda;
}

async function tareaDe(c: Ctx, tareaId: number) {
  const [t] = await c.db
    .select({ tarea: tareasPicking, pedido: pedidos })
    .from(tareasPicking)
    .innerJoin(pedidos, eq(pedidos.id, tareasPicking.pedidoId))
    .where(and(eq(tareasPicking.id, tareaId), eq(pedidos.empresaId, c.empresaId)));
  if (!t) throw new ErrorUsuario("No encuentro esa parada del recorrido.");
  if (t.tarea.estado !== "pendiente") throw new ErrorUsuario("Esa parada ya está resuelta.");
  return t;
}

/** Confirma una parada: valida que la ubicación y el título leídos sean los pedidos. */
export async function confirmarPick(c: Ctx, d: { tareaId: number; ubicacion: string; producto: string; cantidad: unknown }) {
  const n = cantidadValida(d.cantidad);
  return unaVez(c, async (cx) => {
    const { tarea, pedido } = await tareaDe(cx, d.tareaId);
    const u = await buscarUbicacion(cx.db, cx.empresaId, d.ubicacion);
    if (u.id !== tarea.ubicacionId) throw new ErrorUsuario(`Estás en ${u.codigo}, pero esta parada es en otra ubicación. Fijate el cartel.`, "ubicacion_equivocada");
    const p = await buscarProducto(cx.db, cx.empresaId, d.producto);
    if (p.id !== tarea.productoId) throw new ErrorUsuario(`Ese es "${p.titulo}". No es el título que pide esta parada.`, "titulo_equivocado");
    const pendiente = tarea.cantidad - tarea.pickeado;
    if (n > pendiente) throw new ErrorUsuario(`Esta parada pide ${pendiente}. Si tomaste de más, devolvé ${n - pendiente} al estante.`, "cantidad_excedida");

    const tx = cx.db;
    const prep = await zona(tx, cx.empresaId, "preparacion");
    await moverStock(tx, { empresaId: cx.empresaId, productoId: p.id, desdeId: u.id, haciaId: prep.id, cantidad: n, motivo: "picking", referencia: pedido.numero, usuarioId: cx.usuarioId });
    await tx.update(tareasPicking).set({ pickeado: tarea.pickeado + n, estado: n === pendiente ? "hecha" : "pendiente" }).where(eq(tareasPicking.id, tarea.id));
    await tx.update(pedidoLineas).set({ pickeado: sql`${pedidoLineas.pickeado} + ${n}` }).where(eq(pedidoLineas.id, tarea.lineaId));
    // El libro salió de la estantería: deja de estar "prometido" en el mismo paso, así lo disponible no cambia.
    await liberarReserva(tx, cx.empresaId, tarea.lineaId, n);
    const fin = await revisarFin(tx, pedido.id);
    return fin ? `Pedido ${pedido.numero} completo. Llevalo a empaque.` : `${n} × ${p.titulo} ✓`;
  });
}

/**
 * El operario avisa que en la ubicación no está lo que falta. miDepo busca el título en otro
 * lugar; si no hay, la parada queda como faltante y el pedido sigue.
 */
export async function marcarFaltante(c: Ctx, tareaId: number) {
  const { tarea, pedido } = await tareaDe(c, tareaId);
  const falta = tarea.cantidad - tarea.pickeado;
  return c.db.transaction(async (tx) => {
    await tx.update(tareasPicking).set({ estado: "faltante" }).where(eq(tareasPicking.id, tarea.id));
    // No se vuelve a mandar al operario a un lugar donde ya avisó que este título no estaba.
    const yaFallaron = await tx.select({ u: tareasPicking.ubicacionId }).from(tareasPicking).where(and(eq(tareasPicking.lineaId, tarea.lineaId), eq(tareasPicking.estado, "faltante")));
    const libres = await disponible(tx, c.empresaId, [tarea.productoId], new Set(yaFallaron.map((f) => f.u)));
    const { paradas, falta: sinCubrir } = repartir(libres.get(tarea.productoId) ?? [], falta);
    if (paradas.length > 0) {
      await tx.insert(tareasPicking).values(paradas.map((s) => ({ pedidoId: pedido.id, lineaId: tarea.lineaId, productoId: tarea.productoId, ubicacionId: s.ubicacionId, cantidad: s.cantidad })));
    }
    // Lo que no se encontró en ningún estante deja de estar apartado: queda como saldo pendiente.
    if (sinCubrir > 0) await liberarReserva(tx, c.empresaId, tarea.lineaId, sinCubrir);
    await revisarFin(tx, pedido.id);
    if (paradas.length > 0 && sinCubrir === 0) return "Anotado. Encontré el título en otra ubicación y lo sumé al recorrido.";
    if (paradas.length > 0) return `Anotado. Hay una parte en otra ubicación; ${sinCubrir} quedan como faltante.`;
    return `Anotado: ${falta} quedan como faltante. Conviene contar esa ubicación.`;
  });
}

