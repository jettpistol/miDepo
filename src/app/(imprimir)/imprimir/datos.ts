import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { cajaItems, cajas, clientes, pedidoLineas, pedidos, productos } from "@/db/schema";

export async function pedidoConCajas(db: DB, empresaId: number, id: number) {
  const [fila] = await db.select({ p: pedidos, cliente: clientes }).from(pedidos).innerJoin(clientes, eq(clientes.id, pedidos.clienteId)).where(and(eq(pedidos.id, id), eq(pedidos.empresaId, empresaId)));
  if (!fila) notFound();
  const lista = await db.select().from(cajas).where(and(eq(cajas.pedidoId, id), eq(cajas.estado, "cerrada"))).orderBy(asc(cajas.numero));
  const items = lista.length
    ? await db.select({ cajaId: cajaItems.cajaId, cantidad: cajaItems.cantidad, titulo: productos.titulo, codigo: productos.codigoBarras }).from(cajaItems).innerJoin(productos, eq(productos.id, cajaItems.productoId)).where(inArray(cajaItems.cajaId, lista.map((k) => k.id))).orderBy(asc(productos.titulo))
    : [];
  const lineas = await db.select({ l: pedidoLineas, titulo: productos.titulo }).from(pedidoLineas).innerJoin(productos, eq(productos.id, pedidoLineas.productoId)).where(eq(pedidoLineas.pedidoId, id)).orderBy(asc(productos.titulo));
  return { ...fila, cajas: lista, items, lineas };
}

export const kilos = (g: number | null) => ((g ?? 0) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 });
