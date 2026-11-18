import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { cajaItems, cajas, clientes, conteoLineas, conteos, devolucionLineas, devoluciones, empresas, pedidoLineas, pedidos, productos, recepcionLineas, recepciones, ubicaciones } from "@/db/schema";
import { ErrorUsuario } from "../errores";
import { conector, sincronizar, type Empresa } from "../fierro";
import { codigoFierro, csv } from "../fierro/csv";
import type { DocumentoFierro } from "../fierro/tipos";
import { moverStock, zona } from "../stock";
import type { Ctx } from "./comun";

export type TipoEnvio = "pedido" | "recepcion" | "devolucion" | "conteo";
export const NOMBRE_ENVIO: Record<TipoEnvio, string> = { pedido: "Pedido empacado", recepcion: "Recepción", devolucion: "Devolución", conteo: "Conteo" };

export type Pendiente = { tipo: TipoEnvio; id: number; numero: string; detalle: string; fecha: Date };

/** Todo lo que el depósito terminó y Fierro todavía no sabe. */
export async function pendientesDeEnvio(db: DB, empresaId: number): Promise<Pendiente[]> {
  const [ps, rs, ds, ks] = await Promise.all([
    db.select({ id: pedidos.id, numero: pedidos.numero, detalle: clientes.nombre, fecha: pedidos.fecha }).from(pedidos).innerJoin(clientes, eq(clientes.id, pedidos.clienteId)).where(and(eq(pedidos.empresaId, empresaId), eq(pedidos.estado, "empacado"), isNull(pedidos.enviadoAFierro))),
    db.select({ id: recepciones.id, numero: recepciones.numero, detalle: recepciones.proveedor, fecha: recepciones.fecha }).from(recepciones).where(and(eq(recepciones.empresaId, empresaId), eq(recepciones.estado, "cerrada"), isNull(recepciones.enviadoAFierro))),
    db.select({ id: devoluciones.id, numero: devoluciones.numero, detalle: clientes.nombre, fecha: devoluciones.fecha }).from(devoluciones).innerJoin(clientes, eq(clientes.id, devoluciones.clienteId)).where(and(eq(devoluciones.empresaId, empresaId), eq(devoluciones.estado, "cerrada"), isNull(devoluciones.enviadoAFierro))),
    db.select({ id: conteos.id, numero: conteos.nombre, fecha: conteos.fecha }).from(conteos).where(and(eq(conteos.empresaId, empresaId), eq(conteos.estado, "cerrado"), isNull(conteos.enviadoAFierro))),
  ]);
  return [
    ...ps.map((p) => ({ tipo: "pedido" as const, ...p })),
    ...rs.map((r) => ({ tipo: "recepcion" as const, ...r })),
    ...ds.map((d) => ({ tipo: "devolucion" as const, ...d })),
    ...ks.map((k) => ({ tipo: "conteo" as const, ...k, detalle: "Ajustes de stock por ubicación" })),
  ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

/** Arma el archivo CSV de un documento para cargarlo en Fierro. */
export async function archivoPara(db: DB, empresaId: number, tipo: TipoEnvio, id: number): Promise<{ nombre: string; contenido: string }> {
  if (tipo === "pedido") {
    const [p] = await db.select({ numero: pedidos.numero, cliente: clientes.nombre }).from(pedidos).innerJoin(clientes, eq(clientes.id, pedidos.clienteId)).where(and(eq(pedidos.id, id), eq(pedidos.empresaId, empresaId)));
    if (!p) throw new ErrorUsuario("No encuentro ese pedido.");
    const filas = await db
      .select({ caja: cajas.numero, peso: cajas.pesoGramos, isbn: productos.isbn, codigoInterno: productos.codigoInterno, titulo: productos.titulo, cantidad: cajaItems.cantidad })
      .from(cajaItems)
      .innerJoin(cajas, eq(cajas.id, cajaItems.cajaId))
      .innerJoin(productos, eq(productos.id, cajaItems.productoId))
      .where(eq(cajas.pedidoId, id))
      .orderBy(asc(cajas.numero), asc(productos.titulo));
    return { nombre: `pedido-${p.numero}.csv`, contenido: csv(filas.map((f) => [p.numero, p.cliente, f.caja, codigoFierro(f), f.titulo, f.cantidad, f.peso]), ["pedido", "cliente", "caja", "codigo", "titulo", "cantidad", "peso_caja_gramos"]) };
  }
  if (tipo === "recepcion") {
    const [r] = await db.select().from(recepciones).where(and(eq(recepciones.id, id), eq(recepciones.empresaId, empresaId)));
    if (!r) throw new ErrorUsuario("No encuentro esa recepción.");
    const filas = await db.select({ isbn: productos.isbn, codigoInterno: productos.codigoInterno, titulo: productos.titulo, esperado: recepcionLineas.esperado, recibido: recepcionLineas.recibido }).from(recepcionLineas).innerJoin(productos, eq(productos.id, recepcionLineas.productoId)).where(eq(recepcionLineas.recepcionId, id)).orderBy(asc(productos.titulo));
    return { nombre: `recepcion-${r.numero}.csv`, contenido: csv(filas.map((f) => [r.numero, r.proveedor, codigoFierro(f), f.titulo, f.esperado, f.recibido]), ["recepcion", "proveedor", "codigo", "titulo", "esperado", "recibido"]) };
  }
  if (tipo === "devolucion") {
    const [d] = await db.select({ numero: devoluciones.numero, cliente: clientes.nombre }).from(devoluciones).innerJoin(clientes, eq(clientes.id, devoluciones.clienteId)).where(and(eq(devoluciones.id, id), eq(devoluciones.empresaId, empresaId)));
    if (!d) throw new ErrorUsuario("No encuentro esa devolución.");
    const filas = await db.select({ isbn: productos.isbn, codigoInterno: productos.codigoInterno, titulo: productos.titulo, estado: devolucionLineas.estadoLibro, cantidad: devolucionLineas.cantidad }).from(devolucionLineas).innerJoin(productos, eq(productos.id, devolucionLineas.productoId)).where(eq(devolucionLineas.devolucionId, id)).orderBy(asc(productos.titulo));
    return { nombre: `devolucion-${d.numero}.csv`, contenido: csv(filas.map((f) => [d.numero, d.cliente, codigoFierro(f), f.titulo, f.estado, f.cantidad]), ["devolucion", "cliente", "codigo", "titulo", "estado", "cantidad"]) };
  }
  const [k] = await db.select().from(conteos).where(and(eq(conteos.id, id), eq(conteos.empresaId, empresaId)));
  if (!k) throw new ErrorUsuario("No encuentro ese conteo.");
  const filas = await db
    .select({ isbn: productos.isbn, codigoInterno: productos.codigoInterno, contado: conteoLineas.contado, ubicacion: ubicaciones.codigo })
    .from(conteoLineas)
    .innerJoin(productos, eq(productos.id, conteoLineas.productoId))
    .innerJoin(ubicaciones, eq(ubicaciones.id, conteoLineas.ubicacionId))
    .where(eq(conteoLineas.conteoId, id))
    .orderBy(asc(ubicaciones.codigo));
  // Mismo formato que la "importación de tomas de inventario" de Fierro: código, cantidad, ubicación; sin encabezado.
  return { nombre: `conteo-${k.id}.csv`, contenido: csv(filas.filter((f) => f.contado > 0).map((f) => [codigoFierro(f), f.contado, f.ubicacion])) };
}

/**
 * Marca un documento como informado a Fierro. Con el Fierro simulado, además le actualiza
 * el stock, igual que haría la oficina al cargar el archivo. Un pedido sale del depósito acá.
 */
export async function marcarEnviado(c: Ctx, empresa: Empresa, tipo: TipoEnvio, id: number) {
  return c.db.transaction(async (tx) => {
    const doc: DocumentoFierro = { tipo: "recepcion", referencia: "", lineas: [] };
    const ahora = new Date();
    if (tipo === "pedido") {
      const marcado = await tx.update(pedidos).set({ estado: "despachado", despachadoEn: ahora, enviadoAFierro: ahora }).where(and(eq(pedidos.id, id), eq(pedidos.empresaId, c.empresaId), eq(pedidos.estado, "empacado"))).returning();
      if (marcado.length === 0) throw new ErrorUsuario("Ese pedido no está listo para documentar.");
      const prep = await zona(tx, c.empresaId, "preparacion");
      const lineas = await tx.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, id));
      for (const l of lineas) {
        if (l.empacado === 0) continue;
        await moverStock(tx, { empresaId: c.empresaId, productoId: l.productoId, desdeId: prep.id, haciaId: null, cantidad: l.empacado, motivo: "despacho", referencia: marcado[0].numero, usuarioId: c.usuarioId });
        doc.lineas.push({ productoId: l.productoId, delta: -l.empacado });
      }
      doc.tipo = "despacho";
      doc.referencia = marcado[0].numero;
    } else if (tipo === "recepcion") {
      const marcado = await tx.update(recepciones).set({ enviadoAFierro: ahora }).where(and(eq(recepciones.id, id), eq(recepciones.empresaId, c.empresaId), eq(recepciones.estado, "cerrada"), isNull(recepciones.enviadoAFierro))).returning();
      if (marcado.length === 0) throw new ErrorUsuario("Esa recepción no está pendiente de envío.");
      doc.referencia = marcado[0].numero;
      doc.lineas = (await tx.select().from(recepcionLineas).where(eq(recepcionLineas.recepcionId, id))).map((l) => ({ productoId: l.productoId, delta: l.recibido }));
    } else if (tipo === "devolucion") {
      const marcado = await tx.update(devoluciones).set({ enviadoAFierro: ahora }).where(and(eq(devoluciones.id, id), eq(devoluciones.empresaId, c.empresaId), eq(devoluciones.estado, "cerrada"), isNull(devoluciones.enviadoAFierro))).returning();
      if (marcado.length === 0) throw new ErrorUsuario("Esa devolución no está pendiente de envío.");
      doc.tipo = "devolucion";
      doc.referencia = marcado[0].numero;
      doc.lineas = (await tx.select().from(devolucionLineas).where(eq(devolucionLineas.devolucionId, id))).map((l) => ({ productoId: l.productoId, delta: l.cantidad }));
    } else {
      const marcado = await tx.update(conteos).set({ enviadoAFierro: ahora }).where(and(eq(conteos.id, id), eq(conteos.empresaId, c.empresaId), eq(conteos.estado, "cerrado"), isNull(conteos.enviadoAFierro))).returning();
      if (marcado.length === 0) throw new ErrorUsuario("Ese conteo no está pendiente de envío.");
      doc.tipo = "conteo";
      doc.referencia = marcado[0].nombre;
      doc.lineas = (await tx.select().from(conteoLineas).where(eq(conteoLineas.conteoId, id))).map((l) => ({ productoId: l.productoId, delta: l.contado - (l.sistema ?? l.contado) }));
    }
    await conector(tx, empresa).enviar(doc);
    return `${NOMBRE_ENVIO[tipo]} ${doc.referencia}: marcado como cargado en Fierro.`;
  });
}

/** Solo para el Fierro simulado: hace aparecer pedidos o ingresos nuevos "del otro lado". */
export async function simularNovedades(db: DB, empresa: Empresa, que: "pedidos" | "ingresos", cuantos: number) {
  const [actual] = await db
    .update(empresas)
    .set(que === "pedidos" ? { simPedidos: sql`${empresas.simPedidos} + ${cuantos}` } : { simIngresos: sql`${empresas.simIngresos} + ${cuantos}` })
    .where(eq(empresas.id, empresa.id))
    .returning();
  return sincronizar(db, actual);
}
