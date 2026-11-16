import { and, eq, max, sql } from "drizzle-orm";
import { cajaItems, cajas, pedidoLineas, pedidos, productos } from "@/db/schema";
import { ErrorUsuario } from "../errores";
import { buscarProducto } from "../stock";
import { cantidadValida, type Ctx } from "./comun";

async function pedidoParaEmpacar(c: Ctx, id: number) {
  const [p] = await c.db.select().from(pedidos).where(and(eq(pedidos.id, id), eq(pedidos.empresaId, c.empresaId)));
  if (!p) throw new ErrorUsuario("No encuentro ese pedido.");
  if (p.estado === "pendiente" || p.estado === "en_preparacion") throw new ErrorUsuario("Este pedido todavía no terminó el picking.");
  if (p.estado !== "preparado") throw new ErrorUsuario("Este pedido ya está empacado.");
  return p;
}

/** Agrega unidades a la caja abierta del pedido (la abre si no hay ninguna). */
export async function escanearEnCaja(c: Ctx, pedidoId: number, codigo: string, cantidad: unknown) {
  const n = cantidadValida(cantidad);
  const pedido = await pedidoParaEmpacar(c, pedidoId);
  const p = await buscarProducto(c.db, c.empresaId, codigo);
  return c.db.transaction(async (tx) => {
    const [linea] = await tx.select().from(pedidoLineas).where(and(eq(pedidoLineas.pedidoId, pedidoId), eq(pedidoLineas.productoId, p.id)));
    if (!linea || linea.pickeado === 0) throw new ErrorUsuario(`"${p.titulo}" no está entre lo preparado para el pedido ${pedido.numero}.`);
    const resta = linea.pickeado - linea.empacado;
    if (resta === 0) throw new ErrorUsuario(`Ya empacaste todas las unidades de "${p.titulo}".`);
    if (n > resta) throw new ErrorUsuario(`De "${p.titulo}" quedan ${resta} por empacar, no ${n}.`);
    let [caja] = await tx.select().from(cajas).where(and(eq(cajas.pedidoId, pedidoId), eq(cajas.estado, "abierta")));
    if (!caja) {
      const [{ ultimo }] = await tx.select({ ultimo: max(cajas.numero) }).from(cajas).where(eq(cajas.pedidoId, pedidoId));
      [caja] = await tx.insert(cajas).values({ empresaId: c.empresaId, pedidoId, numero: (ultimo ?? 0) + 1 }).returning();
    }
    await tx
      .insert(cajaItems)
      .values({ cajaId: caja.id, productoId: p.id, cantidad: n })
      .onConflictDoUpdate({ target: [cajaItems.cajaId, cajaItems.productoId], set: { cantidad: sql`${cajaItems.cantidad} + ${n}` } });
    await tx.update(pedidoLineas).set({ empacado: linea.empacado + n }).where(eq(pedidoLineas.id, linea.id));
    return `Caja ${caja.numero}: ${n} × ${p.titulo}`;
  });
}

export async function cerrarCaja(c: Ctx, cajaId: number, pesoGramos?: unknown) {
  const [caja] = await c.db.select().from(cajas).where(and(eq(cajas.id, cajaId), eq(cajas.empresaId, c.empresaId)));
  if (!caja || caja.estado !== "abierta") throw new ErrorUsuario("Esa caja no está abierta.");
  const items = await c.db
    .select({ cantidad: cajaItems.cantidad, peso: productos.pesoGramos })
    .from(cajaItems)
    .innerJoin(productos, eq(productos.id, cajaItems.productoId))
    .where(eq(cajaItems.cajaId, cajaId));
  if (items.length === 0) throw new ErrorUsuario("La caja está vacía.");
  const estimado = items.reduce((s, i) => s + i.cantidad * i.peso, 0);
  const real = Number(pesoGramos);
  await c.db.update(cajas).set({ estado: "cerrada", pesoGramos: Number.isFinite(real) && real > 0 ? Math.round(real) : estimado }).where(eq(cajas.id, cajaId));
  return `Caja ${caja.numero} cerrada.`;
}

/** Deshace una caja abierta (por si se cargó mal): lo que tenía vuelve a "por empacar". */
export async function vaciarCaja(c: Ctx, cajaId: number) {
  const [caja] = await c.db.select().from(cajas).where(and(eq(cajas.id, cajaId), eq(cajas.empresaId, c.empresaId)));
  if (!caja || caja.estado !== "abierta") throw new ErrorUsuario("Solo se puede vaciar una caja abierta.");
  await c.db.transaction(async (tx) => {
    const items = await tx.select().from(cajaItems).where(eq(cajaItems.cajaId, cajaId));
    for (const i of items) {
      await tx.update(pedidoLineas).set({ empacado: sql`${pedidoLineas.empacado} - ${i.cantidad}` }).where(and(eq(pedidoLineas.pedidoId, caja.pedidoId), eq(pedidoLineas.productoId, i.productoId)));
    }
    await tx.delete(cajas).where(eq(cajas.id, cajaId));
  });
  return `Caja ${caja.numero} vaciada.`;
}

export async function finalizarEmpaque(c: Ctx, pedidoId: number) {
  const pedido = await pedidoParaEmpacar(c, pedidoId);
  const lineas = await c.db.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, pedidoId));
  const sinEmpacar = lineas.reduce((s, l) => s + (l.pickeado - l.empacado), 0);
  if (sinEmpacar > 0) throw new ErrorUsuario(`Quedan ${sinEmpacar} unidades preparadas sin empacar.`);
  const delPedido = await c.db.select().from(cajas).where(eq(cajas.pedidoId, pedidoId));
  if (delPedido.some((k) => k.estado === "abierta")) throw new ErrorUsuario("Cerrá la caja abierta antes de terminar.");
  if (delPedido.length === 0 && lineas.some((l) => l.pickeado > 0)) throw new ErrorUsuario("Todavía no armaste ninguna caja.");
  await c.db.update(pedidos).set({ estado: "empacado" }).where(eq(pedidos.id, pedidoId));
  return `Pedido ${pedido.numero} empacado en ${delPedido.length} caja${delPedido.length === 1 ? "" : "s"}. Ya se puede documentar en Fierro.`;
}
