import { and, eq, sql } from "drizzle-orm";
import type { DB, Ejecutor } from "@/db";
import { clientes, empresas, fierroStock, pedidoLineas, pedidos, productos, recepcionLineas, recepciones } from "@/db/schema";
import { asignarReservas, reservarPedido } from "../reservas";
import { FierroSimulado } from "./simulado";
import type { ConectorFierro } from "./tipos";

export type Empresa = typeof empresas.$inferSelect;

/** Cuando exista el conector real, se elige acá según la configuración de la empresa. */
export function conector(db: Ejecutor, empresa: Empresa): ConectorFierro {
  return new FierroSimulado(db, empresa);
}

const enTandas = <T,>(lista: T[], n = 400) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

/**
 * Trae de Fierro catálogo, clientes, pedidos e ingresos esperados. En catálogo y clientes Fierro
 * manda: lo que cambió allá pisa lo de acá. El stock físico no se trae: es de miDepo. Lo único
 * que se compara es el número de Fierro, en la conciliación.
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
        .values(tanda.map((l) => ({ empresaId: empresa.id, origen: "fierro" as const, idExterno: l.id, codigoInterno: l.codigoInterno, isbn: l.isbn, codigoBarras: l.codigoBarras, titulo: l.titulo, autor: l.autor, sello: l.sello, tipo: l.tipo, precio: l.precio, pesoGramos: l.pesoGramos })))
        .onConflictDoUpdate({
          target: [productos.empresaId, productos.origen, productos.idExterno],
          set: { codigoInterno: sql`excluded.codigo_interno`, isbn: sql`excluded.isbn`, codigoBarras: sql`excluded.codigo_barras`, titulo: sql`excluded.titulo`, autor: sql`excluded.autor`, sello: sql`excluded.sello`, tipo: sql`excluded.tipo`, precio: sql`excluded.precio`, pesoGramos: sql`excluded.peso_gramos` },
        });
    }
    for (const tanda of enTandas(clis)) {
      await tx
        .insert(clientes)
        .values(tanda.map((c) => ({ empresaId: empresa.id, origen: "fierro" as const, idExterno: c.id, nombre: c.nombre, direccion: c.direccion, localidad: c.localidad, provincia: c.provincia })))
        .onConflictDoUpdate({
          target: [clientes.empresaId, clientes.origen, clientes.idExterno],
          set: { nombre: sql`excluded.nombre`, direccion: sql`excluded.direccion`, localidad: sql`excluded.localidad`, provincia: sql`excluded.provincia` },
        });
    }

    const idProducto = new Map((await tx.select({ id: productos.id, f: productos.idExterno }).from(productos).where(and(eq(productos.empresaId, empresa.id), eq(productos.origen, "fierro")))).map((p) => [p.f, p.id]));
    const idCliente = new Map((await tx.select({ id: clientes.id, f: clientes.idExterno }).from(clientes).where(and(eq(clientes.empresaId, empresa.id), eq(clientes.origen, "fierro")))).map((c) => [c.f, c.id]));

    const yaPedidos = new Set((await tx.select({ f: pedidos.idExterno }).from(pedidos).where(and(eq(pedidos.empresaId, empresa.id), eq(pedidos.origen, "fierro")))).map((p) => p.f));
    for (const p of peds) {
      if (yaPedidos.has(p.id)) continue;
      const clienteId = idCliente.get(p.clienteId);
      const ls = p.lineas.flatMap((l) => (idProducto.has(l.libroId) ? [{ productoId: idProducto.get(l.libroId)!, cantidad: l.cantidad }] : []));
      if (!clienteId || ls.length === 0) continue;
      const [nuevo] = await tx.insert(pedidos).values({ empresaId: empresa.id, origen: "fierro", idExterno: p.id, numero: p.numero, clienteId, modalidad: p.modalidad, fecha: p.fecha }).returning({ id: pedidos.id });
      await tx.insert(pedidoLineas).values(ls.map((l) => ({ pedidoId: nuevo.id, ...l })));
      // El stock es de miDepo: el pedido aparta lo que haya apenas entra, antes de que lo pida otro.
      await reservarPedido(tx, empresa.id, nuevo.id);
      resumen.pedidosNuevos++;
    }

    const yaIngresos = new Set((await tx.select({ f: recepciones.idExterno }).from(recepciones).where(and(eq(recepciones.empresaId, empresa.id), eq(recepciones.origen, "fierro")))).map((r) => r.f));
    for (const i of ings) {
      if (yaIngresos.has(i.id)) continue;
      const ls = i.lineas.flatMap((l) => (idProducto.has(l.libroId) ? [{ productoId: idProducto.get(l.libroId)!, esperado: l.cantidad }] : []));
      if (ls.length === 0) continue;
      const [nueva] = await tx.insert(recepciones).values({ empresaId: empresa.id, origen: "fierro", idExterno: i.id, numero: i.numero, proveedor: i.proveedor, fecha: i.fecha }).returning({ id: recepciones.id });
      await tx.insert(recepcionLineas).values(ls.map((l) => ({ recepcionId: nueva.id, ...l })));
      resumen.ingresosNuevos++;
    }

    // Foto del stock según Fierro, para la conciliación.
    const filas = [...stockFierro].flatMap(([f, cantidad]) => (idProducto.has(f) ? [{ empresaId: empresa.id, productoId: idProducto.get(f)!, cantidad }] : []));
    for (const tanda of enTandas(filas, 1000)) {
      await tx.insert(fierroStock).values(tanda).onConflictDoUpdate({ target: [fierroStock.empresaId, fierroStock.productoId], set: { cantidad: sql`excluded.cantidad` } });
    }
    // Pedidos que habían quedado con saldo pueden cubrirse con stock que apareció desde la última vez.
    await asignarReservas(tx, empresa.id);
    await tx.update(empresas).set({ ultimaSync: new Date() }).where(eq(empresas.id, empresa.id));
  });
  return resumen;
}

