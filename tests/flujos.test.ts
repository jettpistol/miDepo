import { beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq, sql, sum } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, migrar, type DB } from "@/db";
import { cajas, empresas, fierroStock, pedidoLineas, pedidos, productos, recepciones, stock, tareasPicking, ubicaciones } from "@/db/schema";
import { crearEmpresa, crearUsuario } from "@/db/seed";
import { sincronizar } from "@/lib/fierro";
import { ErrorUsuario } from "@/lib/errores";
import { moverStock, zona } from "@/lib/stock";
import { generarCodigos, MODELOS, validarEsquema } from "@/lib/ubicaciones";
import type { Ctx } from "@/lib/flujos/comun";
import { cerrarRecepcion, escanearRecepcion } from "@/lib/flujos/recepcion";
import { mover } from "@/lib/flujos/mover";
import { confirmarPick, marcarFaltante, tomarPedido } from "@/lib/flujos/picking";
import { cerrarCaja, escanearEnCaja, finalizarEmpaque } from "@/lib/flujos/empaque";
import { cerrarDevolucion, crearDevolucion, escanearDevolucion } from "@/lib/flujos/devoluciones";
import { cerrarConteo, crearConteo, diferencias, escanearConteo, marcarUbicacion } from "@/lib/flujos/conteos";
import { archivoPara, marcarEnviado, pendientesDeEnvio, simularNovedades } from "@/lib/flujos/envios";

let db: DB;
let c: Ctx;
let empresa: typeof empresas.$inferSelect;

const total = async (productoId: number) => Number((await db.select({ n: sum(stock.cantidad) }).from(stock).where(eq(stock.productoId, productoId)))[0].n ?? 0);
const enUbicacion = async (productoId: number, ubicacionId: number) => (await db.select().from(stock).where(and(eq(stock.productoId, productoId), eq(stock.ubicacionId, ubicacionId))))[0]?.cantidad ?? 0;
const fierro = async (productoId: number) => (await db.select().from(fierroStock).where(eq(fierroStock.productoId, productoId)))[0]?.cantidad ?? 0;

async function armarEmpresa(nombre: string, slug: string, semilla: number) {
  const base = await crearEmpresa(db, { nombre, slug });
  const [e] = await db.update(empresas).set({ simSemilla: semilla, simTitulos: 60, simClientes: 5, simPedidos: 3, simIngresos: 1 }).where(eq(empresas.id, base.id)).returning();
  const u = await crearUsuario(db, e.id, { nombre: "Prueba", email: `${slug}@prueba.test`, rol: "admin", clave: "clave-larga" });
  await db.insert(ubicaciones).values(["A-01-1", "A-01-2", "A-02-1"].map((codigo) => ({ empresaId: e.id, codigo })));
  await sincronizar(db, e);
  return { e, u };
}

beforeAll(async () => {
  await migrar();
  db = await getDb();
  const { e, u } = await armarEmpresa("Prueba SA", "prueba", 3);
  empresa = e;
  c = { db, empresaId: e.id, usuarioId: u.id };
});

describe("ubicaciones", () => {
  it("genera los códigos de cada modelo sin repetir", () => {
    for (const m of MODELOS) {
      const codigos = generarCodigos(m.esquema);
      expect(new Set(codigos).size).toBe(codigos.length);
      expect(validarEsquema(m.esquema)).toBeNull();
    }
    expect(generarCodigos(MODELOS[0].esquema)[0]).toBe("A-01-1");
    expect(generarCodigos(MODELOS[1].esquema)[0]).toBe("E01-1");
  });
});

describe("stock", () => {
  it("no deja una ubicación en negativo", async () => {
    const [p] = await db.select().from(productos).where(eq(productos.empresaId, c.empresaId)).limit(1);
    const [u] = await db.select().from(ubicaciones).where(and(eq(ubicaciones.empresaId, c.empresaId), eq(ubicaciones.codigo, "A-01-1")));
    await expect(moverStock(db, { empresaId: c.empresaId, productoId: p.id, desdeId: u.id, haciaId: null, cantidad: 1, motivo: "movimiento" })).rejects.toBeInstanceOf(ErrorUsuario);
  });
});

describe("circuito completo", () => {
  it("recibe, guarda, prepara, empaca y despacha, y Fierro queda igual que el depósito", async () => {
    // Recepción del ingreso avisado por Fierro, con todo lo esperado.
    const [rec] = await db.select().from(recepciones).where(eq(recepciones.empresaId, c.empresaId));
    const lineasRec = await db.query.recepcionLineas.findMany({ where: (l, { eq }) => eq(l.recepcionId, rec.id) }).catch(() => null);
    expect(lineasRec).not.toBeNull();
    const prods = new Map((await db.select().from(productos).where(eq(productos.empresaId, c.empresaId))).map((p) => [p.id, p]));
    for (const l of lineasRec!) await escanearRecepcion(c, rec.id, prods.get(l.productoId)!.codigoBarras, l.esperado);
    await cerrarRecepcion(c, rec.id);
    await expect(escanearRecepcion(c, rec.id, prods.get(lineasRec![0].productoId)!.codigoBarras, 1)).rejects.toThrow(/cerrada/);
    const recepcion = await zona(db, c.empresaId, "recepcion");
    expect(await enUbicacion(lineasRec![0].productoId, recepcion.id)).toBe(lineasRec![0].esperado);

    // Guardado: todo lo recibido va a A-01-1. Sin stock en estantería no hay picking posible.
    for (const l of lineasRec!) await mover(c, { origen: "RECEPCION", producto: prods.get(l.productoId)!.codigoBarras, destino: "a-01-1", cantidad: l.esperado });
    expect(await enUbicacion(lineasRec![0].productoId, recepcion.id)).toBe(0);
    await marcarEnviado(c, empresa, "recepcion", rec.id);
    expect(await fierro(lineasRec![0].productoId)).toBe(lineasRec![0].esperado);

    // Para que el pedido se pueda preparar, ponemos stock de sus títulos en dos ubicaciones.
    const [ped] = await db.select().from(pedidos).where(eq(pedidos.empresaId, c.empresaId)).orderBy(asc(pedidos.id)).limit(1);
    const lineas = await db.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, ped.id));
    const [a2] = await db.select().from(ubicaciones).where(and(eq(ubicaciones.empresaId, c.empresaId), eq(ubicaciones.codigo, "A-02-1")));
    const antes = new Map<number, number>();
    for (const l of lineas) {
      await moverStock(db, { empresaId: c.empresaId, productoId: l.productoId, desdeId: null, haciaId: a2.id, cantidad: l.cantidad, motivo: "inicial" });
      await db.insert(fierroStock).values({ empresaId: c.empresaId, productoId: l.productoId, cantidad: l.cantidad }).onConflictDoUpdate({ target: [fierroStock.empresaId, fierroStock.productoId], set: { cantidad: sql`${fierroStock.cantidad} + ${l.cantidad}` } });
      antes.set(l.productoId, await total(l.productoId));
    }

    await tomarPedido(c, ped.id);
    await expect(tomarPedido(c, ped.id)).rejects.toThrow(/ya lo tomó/);
    const tareas = await db.select({ t: tareasPicking, u: ubicaciones.codigo }).from(tareasPicking).innerJoin(ubicaciones, eq(ubicaciones.id, tareasPicking.ubicacionId)).where(eq(tareasPicking.pedidoId, ped.id));
    expect(tareas.reduce((s, t) => s + t.t.cantidad, 0)).toBe(lineas.reduce((s, l) => s + l.cantidad, 0));

    // Validaciones del picking: ubicación equivocada, título equivocado, cantidad de más.
    const [t0, ...resto] = tareas;
    const otra = t0.u === "A-01-2" ? "A-02-1" : "A-01-2";
    await expect(confirmarPick(c, { tareaId: t0.t.id, ubicacion: otra, producto: prods.get(t0.t.productoId)!.codigoBarras, cantidad: 1 })).rejects.toThrow(/otra ubicación/);
    const ajeno = [...prods.values()].find((p) => p.id !== t0.t.productoId)!;
    await expect(confirmarPick(c, { tareaId: t0.t.id, ubicacion: t0.u, producto: ajeno.codigoBarras, cantidad: 1 })).rejects.toThrow(/No es el título/);
    await expect(confirmarPick(c, { tareaId: t0.t.id, ubicacion: t0.u, producto: prods.get(t0.t.productoId)!.codigoBarras, cantidad: t0.t.cantidad + 1 })).rejects.toThrow(/pide/);

    for (const t of [t0, ...resto]) await confirmarPick(c, { tareaId: t.t.id, ubicacion: t.u, producto: prods.get(t.t.productoId)!.codigoBarras, cantidad: t.t.cantidad });
    expect((await db.select().from(pedidos).where(eq(pedidos.id, ped.id)))[0].estado).toBe("preparado");
    // Lo preparado sigue dentro del depósito hasta el despacho.
    for (const l of lineas) expect(await total(l.productoId)).toBe(antes.get(l.productoId));

    // Empaque: no acepta títulos ajenos ni más unidades de las preparadas.
    await expect(escanearEnCaja(c, ped.id, [...prods.values()].find((p) => !lineas.some((l) => l.productoId === p.id))!.codigoBarras, 1)).rejects.toThrow(/no está entre lo preparado/);
    await expect(escanearEnCaja(c, ped.id, prods.get(lineas[0].productoId)!.codigoBarras, lineas[0].cantidad + 1)).rejects.toThrow(/quedan/);
    for (const l of lineas) await escanearEnCaja(c, ped.id, prods.get(l.productoId)!.codigoBarras, l.cantidad);
    await expect(finalizarEmpaque(c, ped.id)).rejects.toThrow(/caja abierta/);
    const [caja] = await db.select().from(cajas).where(eq(cajas.pedidoId, ped.id));
    await cerrarCaja(c, caja.id);
    await finalizarEmpaque(c, ped.id);

    const pendientes = await pendientesDeEnvio(db, c.empresaId);
    expect(pendientes.map((p) => p.tipo)).toContain("pedido");
    const archivo = await archivoPara(db, c.empresaId, "pedido", ped.id);
    expect(archivo.contenido.split("\r\n").filter(Boolean).length).toBe(lineas.length + 1);

    await marcarEnviado(c, empresa, "pedido", ped.id);
    for (const l of lineas) {
      expect(await total(l.productoId)).toBe(antes.get(l.productoId)! - l.cantidad);
      expect(await fierro(l.productoId)).toBe(await total(l.productoId));
    }
    await expect(marcarEnviado(c, empresa, "pedido", ped.id)).rejects.toThrow(/no está listo/);
  });

  it("un faltante busca el título en otra ubicación y, si no hay, deja seguir el pedido", async () => {
    const [ped] = await db.select().from(pedidos).where(and(eq(pedidos.empresaId, c.empresaId), eq(pedidos.estado, "pendiente"))).limit(1);
    const lineas = await db.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, ped.id));
    const us = await db.select().from(ubicaciones).where(and(eq(ubicaciones.empresaId, c.empresaId), eq(ubicaciones.tipo, "estanteria"))).orderBy(asc(ubicaciones.codigo));
    // El primer título queda repartido en dos lugares que alcanzan cada uno por sí solo.
    for (const u of us.slice(1, 3)) await moverStock(db, { empresaId: c.empresaId, productoId: lineas[0].productoId, desdeId: null, haciaId: u.id, cantidad: lineas[0].cantidad, motivo: "inicial" });
    // Vaciamos lo que hubiera del resto para forzar faltantes.
    for (const l of lineas.slice(1)) await db.delete(stock).where(eq(stock.productoId, l.productoId));
    await db.delete(stock).where(and(eq(stock.productoId, lineas[0].productoId), eq(stock.ubicacionId, us[0].id)));

    await tomarPedido(c, ped.id);
    const pend = await db.select().from(tareasPicking).where(and(eq(tareasPicking.pedidoId, ped.id), eq(tareasPicking.estado, "pendiente")));
    expect(pend).toHaveLength(1);
    expect(await marcarFaltante(c, pend[0].id)).toMatch(/otra ubicación/);
    const [nueva] = await db.select().from(tareasPicking).where(and(eq(tareasPicking.pedidoId, ped.id), eq(tareasPicking.estado, "pendiente")));
    expect(nueva.ubicacionId).not.toBe(pend[0].ubicacionId);
    expect(await marcarFaltante(c, nueva.id)).toMatch(/faltante/);
    expect((await db.select().from(pedidos).where(eq(pedidos.id, ped.id)))[0].estado).toBe("preparado");
  });
});

describe("devoluciones y conteos", () => {
  it("una devolución reparte los libros según su estado", async () => {
    const [p] = await db.select().from(productos).where(eq(productos.empresaId, c.empresaId)).orderBy(asc(productos.id)).limit(1);
    const cli = (await db.query.clientes.findFirst({ where: (k, { eq }) => eq(k.empresaId, c.empresaId) }))!;
    const antes = await total(p.id);
    const id = await crearDevolucion(c, cli.id);
    await escanearDevolucion(c, id, p.codigoBarras, "vendible", 3);
    await escanearDevolucion(c, id, p.codigoBarras, "danado", 2);
    await escanearDevolucion(c, id, p.codigoBarras, "vendible", 1);
    await expect(escanearDevolucion(c, id, p.codigoBarras, "regular", 1)).rejects.toThrow(/estado/);
    await cerrarDevolucion(c, id);
    expect(await enUbicacion(p.id, (await zona(db, c.empresaId, "devoluciones")).id)).toBe(4);
    expect(await enUbicacion(p.id, (await zona(db, c.empresaId, "danados")).id)).toBe(2);
    expect(await total(p.id)).toBe(antes + 6);
  });

  it("un conteo ajusta solo las ubicaciones contadas", async () => {
    const [u1] = await db.select().from(ubicaciones).where(and(eq(ubicaciones.empresaId, c.empresaId), eq(ubicaciones.codigo, "A-01-1")));
    const [u2] = await db.select().from(ubicaciones).where(and(eq(ubicaciones.empresaId, c.empresaId), eq(ubicaciones.codigo, "A-01-2")));
    const enU1 = await db.select().from(stock).where(eq(stock.ubicacionId, u1.id));
    expect(enU1.length).toBeGreaterThan(1);
    const enU2Antes = await db.select().from(stock).where(eq(stock.ubicacionId, u2.id));
    const prods = new Map((await db.select().from(productos).where(eq(productos.empresaId, c.empresaId))).map((p) => [p.id, p]));

    const id = await crearConteo(c, "Pasillo A", "a-01");
    // En A-01-1: el primer título tiene 2 menos, el segundo no aparece, el resto coincide.
    await escanearConteo(c, id, u1.id, prods.get(enU1[0].productoId)!.codigoBarras, enU1[0].cantidad - 2);
    for (const s of enU1.slice(2)) await escanearConteo(c, id, u1.id, prods.get(s.productoId)!.codigoBarras, s.cantidad);
    await marcarUbicacion(c, id, u1.id, true);
    await expect(escanearConteo(c, id, u1.id, prods.get(enU1[0].productoId)!.codigoBarras, 1)).rejects.toThrow(/ya se dio por contada/);

    const difs = (await diferencias(db, id)).filter((d) => d.sistema !== d.contado);
    expect(difs).toHaveLength(2);
    await cerrarConteo(c, id);
    expect(await enUbicacion(enU1[0].productoId, u1.id)).toBe(enU1[0].cantidad - 2);
    expect(await enUbicacion(enU1[1].productoId, u1.id)).toBe(0);
    // A-01-2 no se contó: queda como estaba.
    expect(await db.select().from(stock).where(eq(stock.ubicacionId, u2.id))).toEqual(enU2Antes);
    const archivo = await archivoPara(db, c.empresaId, "conteo", id);
    expect(archivo.contenido).toContain(",A-01-1");
  });
});

describe("varias empresas", () => {
  it("una empresa no ve ni toca lo de otra", async () => {
    const { e, u } = await armarEmpresa("Otra SRL", "otra", 9);
    const otra: Ctx = { db, empresaId: e.id, usuarioId: u.id };
    const [pedAjeno] = await db.select().from(pedidos).where(and(eq(pedidos.empresaId, c.empresaId), eq(pedidos.estado, "pendiente"))).limit(1);
    await expect(tomarPedido(otra, pedAjeno.id)).rejects.toThrow(/No encuentro/);
    const [prodAjeno] = await db.select().from(productos).where(eq(productos.empresaId, c.empresaId)).limit(1);
    await expect(mover(otra, { origen: "RECEPCION", producto: prodAjeno.codigoBarras, destino: "A-01-1", cantidad: 1 })).rejects.toThrow(/No conozco el código/);
    await expect(archivoPara(db, e.id, "pedido", pedAjeno.id)).rejects.toThrow(/No encuentro/);
    expect(await pendientesDeEnvio(db, e.id)).toHaveLength(0);
  });

  it("simular pedidos nuevos en Fierro los trae en la sincronización", async () => {
    const antes = (await db.select().from(pedidos).where(eq(pedidos.empresaId, c.empresaId))).length;
    const r = await simularNovedades(db, empresa, "pedidos", 4);
    expect(r.pedidosNuevos).toBe(4);
    expect((await db.select().from(pedidos).where(eq(pedidos.empresaId, c.empresaId))).length).toBe(antes + 4);
  });
});
