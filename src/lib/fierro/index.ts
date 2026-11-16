import { eq, sql } from "drizzle-orm";
import type { DB, Ejecutor } from "@/db";
import { clientes, empresas, fierroStock, pedidoLineas, pedidos, productos, recepcionLineas, recepciones } from "@/db/schema";
import { FierroSimulado } from "./simulado";
import type { ConectorFierro } from "./tipos";

export type Empresa = typeof empresas.$inferSelect;

/** Cuando exista el conector real, se elige acá según la configuración de la empresa. */
export function conector(db: Ejecutor, empresa: Empresa): ConectorFierro {
  return new FierroSimulado(db, empresa);
}

const enTandas = <T,>(lista: T[], n = 400) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

/**
 * Trae de Fierro catálogo, clientes, pedidos e ingresos esperados. Fierro manda: lo que
 * cambió allá pisa lo de acá. Lo único que miDepo no toca son los pedidos ya empezados.
 */
export async function sincronizar(db: DB, empresa: Empresa) {
  const fierro = conector(db, empresa);
  const [libros, clis, peds, ings] = await Promise.all([fierro.libros(), fierro.clientes(), fierro.pedidosPendientes(), fierro.ingresosEsperados()]);
  // Se lee antes de abrir la transacción: adentro solo se puede usar `tx`.
  const stockFierro = await fierro.stock();
  const resumen = { titulos: libros.length, clientes: clis.length, pedidosNuevos: 0, ingresosNuevos: 0 };

  await db.transaction(async (tx) => {
    for (const tanda of enTandas(libros)) {
      await tx
        .insert(productos)
        .values(tanda.map((l) => ({ empresaId: empresa.id, fierroId: l.id, codigoInterno: l.codigoInterno, isbn: l.isbn, codigoBarras: l.codigoBarras, titulo: l.titulo, autor: l.autor, sello: l.sello, tipo: l.tipo, precio: l.precio, pesoGramos: l.pesoGramos })))
        .onConflictDoUpdate({
          target: [productos.empresaId, productos.fierroId],
          set: { codigoInterno: sql`excluded.codigo_interno`, isbn: sql`excluded.isbn`, codigoBarras: sql`excluded.codigo_barras`, titulo: sql`excluded.titulo`, autor: sql`excluded.autor`, sello: sql`excluded.sello`, tipo: sql`excluded.tipo`, precio: sql`excluded.precio`, pesoGramos: sql`excluded.peso_gramos` },
        });
    }
    for (const tanda of enTandas(clis)) {
      await tx
        .insert(clientes)
        .values(tanda.map((c) => ({ empresaId: empresa.id, fierroId: c.id, nombre: c.nombre, direccion: c.direccion, localidad: c.localidad, provincia: c.provincia })))
        .onConflictDoUpdate({
          target: [clientes.empresaId, clientes.fierroId],
          set: { nombre: sql`excluded.nombre`, direccion: sql`excluded.direccion`, localidad: sql`excluded.localidad`, provincia: sql`excluded.provincia` },
        });
    }

    const idProducto = new Map((await tx.select({ id: productos.id, f: productos.fierroId }).from(productos).where(eq(productos.empresaId, empresa.id))).map((p) => [p.f, p.id]));
    const idCliente = new Map((await tx.select({ id: clientes.id, f: clientes.fierroId }).from(clientes).where(eq(clientes.empresaId, empresa.id))).map((c) => [c.f, c.id]));

    const yaPedidos = new Set((await tx.select({ f: pedidos.fierroId }).from(pedidos).where(eq(pedidos.empresaId, empresa.id))).map((p) => p.f));
    for (const p of peds) {
      if (yaPedidos.has(p.id)) continue;
      const clienteId = idCliente.get(p.clienteId);
      const ls = p.lineas.flatMap((l) => (idProducto.has(l.libroId) ? [{ productoId: idProducto.get(l.libroId)!, cantidad: l.cantidad }] : []));
      if (!clienteId || ls.length === 0) continue;
      const [nuevo] = await tx.insert(pedidos).values({ empresaId: empresa.id, fierroId: p.id, numero: p.numero, clienteId, modalidad: p.modalidad, fecha: p.fecha }).returning({ id: pedidos.id });
      await tx.insert(pedidoLineas).values(ls.map((l) => ({ pedidoId: nuevo.id, ...l })));
      resumen.pedidosNuevos++;
    }

    const yaIngresos = new Set((await tx.select({ f: recepciones.fierroId }).from(recepciones).where(eq(recepciones.empresaId, empresa.id))).map((r) => r.f));
    for (const i of ings) {
      if (yaIngresos.has(i.id)) continue;
      const ls = i.lineas.flatMap((l) => (idProducto.has(l.libroId) ? [{ productoId: idProducto.get(l.libroId)!, esperado: l.cantidad }] : []));
      if (ls.length === 0) continue;
      const [nueva] = await tx.insert(recepciones).values({ empresaId: empresa.id, fierroId: i.id, numero: i.numero, proveedor: i.proveedor, fecha: i.fecha }).returning({ id: recepciones.id });
      await tx.insert(recepcionLineas).values(ls.map((l) => ({ recepcionId: nueva.id, ...l })));
      resumen.ingresosNuevos++;
    }

    // Foto del stock según Fierro, para la conciliación.
    const filas = [...stockFierro].flatMap(([f, cantidad]) => (idProducto.has(f) ? [{ empresaId: empresa.id, productoId: idProducto.get(f)!, cantidad }] : []));
    for (const tanda of enTandas(filas, 1000)) {
      await tx.insert(fierroStock).values(tanda).onConflictDoUpdate({ target: [fierroStock.empresaId, fierroStock.productoId], set: { cantidad: sql`excluded.cantidad` } });
    }
    await tx.update(empresas).set({ ultimaSync: new Date() }).where(eq(empresas.id, empresa.id));
  });
  return resumen;
}

