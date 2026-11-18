import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, migrar, type DB } from "@/db";
import { erroresEscaneo, movimientos, pedidoLineas, pedidos, productos, recepciones, tareasPicking, ubicaciones } from "@/db/schema";
import { crearEmpresa, crearUsuario } from "@/db/seed";
import { sincronizar } from "@/lib/fierro";
import { ErrorUsuario } from "@/lib/errores";
import { moduloActivo } from "@/lib/modulos";
import { asignarReservas, resumenStock } from "@/lib/reservas";
import { moverStock, zona } from "@/lib/stock";
import { registrarErrorEscaneo, type Ctx } from "@/lib/flujos/comun";
import { cancelarPedido, crearCliente, crearPedidoManual, crearProducto, ean13Valido } from "@/lib/flujos/pedidos";
import { mover } from "@/lib/flujos/mover";
import { confirmarPick, marcarFaltante, tomarPedido } from "@/lib/flujos/picking";
import { cerrarCaja, escanearEnCaja, finalizarEmpaque } from "@/lib/flujos/empaque";
import { crearRecepcionSinAviso, escanearRecepcion } from "@/lib/flujos/recepcion";
import { marcarEnviado } from "@/lib/flujos/envios";

let db: DB;
let c: Ctx;
let empresa: Awaited<ReturnType<typeof crearEmpresa>>;
let clienteId: number;
const estante: Record<string, number> = {};

/** Un título nuevo con `cantidad` unidades en una estantería. */
async function titulo(codigo: string, cantidad: number, ubicacion = "A-01-1") {
  const p = await crearProducto(c, { titulo: `Libro ${codigo}`, codigoInterno: codigo });
  if (cantidad > 0) await moverStock(db, { empresaId: c.empresaId, productoId: p.id, desdeId: null, haciaId: estante[ubicacion], cantidad, motivo: "inicial" });
  return p;
}
const resumen = async (productoId: number) => (await resumenStock(db, c.empresaId, [productoId])).get(productoId)!;
const pedido = (lineas: { codigo: string; cantidad: number }[]) => crearPedidoManual(c, { clienteId, lineas });
const lineaDe = async (pedidoId: number) => (await db.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, pedidoId)))[0];

beforeAll(async () => {
  await migrar();
  db = await getDb();
  empresa = await crearEmpresa(db, { nombre: "Reservas SA", slug: "reservas" });
  const u = await crearUsuario(db, empresa.id, { nombre: "Prueba", email: "reservas@prueba.test", rol: "admin", clave: "clave-larga" });
  c = { db, empresaId: empresa.id, usuarioId: u.id };
  for (const codigo of ["A-01-1", "A-01-2", "A-02-1"]) {
    const [ub] = await db.insert(ubicaciones).values({ empresaId: empresa.id, codigo }).returning();
    estante[codigo] = ub.id;
  }
  clienteId = (await crearCliente(c, { nombre: "Comiquería Norte" })).id;
});

describe("reserva de stock", () => {
  it("aparta al entrar el pedido y no promete dos veces el mismo ejemplar", async () => {
    const p = await titulo("RES-1", 3);
    const a = await pedido([{ codigo: "RES-1", cantidad: 2 }]);
    const b = await pedido([{ codigo: "RES-1", cantidad: 2 }]);
    expect((await lineaDe(a.id)).reservado).toBe(2);
    expect((await lineaDe(b.id)).reservado).toBe(1); // solo quedaba 1
    expect(b.mensaje).toMatch(/1 de 2/);
    expect(await resumen(p.id)).toEqual({ fisico: 3, vendible: 3, comprometido: 3, disponible: 0 });
  });

  it("dos pedidos a la vez por el último ejemplar: uno solo se lo queda", async () => {
    const p = await titulo("RES-2", 1);
    const [x, y] = await Promise.all([pedido([{ codigo: "RES-2", cantidad: 1 }]), pedido([{ codigo: "RES-2", cantidad: 1 }])]);
    expect((await lineaDe(x.id)).reservado + (await lineaDe(y.id)).reservado).toBe(1);
    expect((await resumen(p.id)).comprometido).toBe(1);
  });

  it("no cuenta como vendible lo que está en Recepción ni lo ya preparado", async () => {
    const p = await titulo("RES-3", 0);
    const rec = await zona(db, c.empresaId, "recepcion");
    await moverStock(db, { empresaId: c.empresaId, productoId: p.id, desdeId: null, haciaId: rec.id, cantidad: 5, motivo: "recepcion" });
    const ped = await pedido([{ codigo: "RES-3", cantidad: 2 }]);
    expect((await lineaDe(ped.id)).reservado).toBe(0);
    expect(await resumen(p.id)).toEqual({ fisico: 5, vendible: 0, comprometido: 0, disponible: 0 });
  });

  it("al guardar stock en una estantería, el pedido que esperaba lo aparta", async () => {
    const p = await titulo("RES-4", 0);
    const rec = await zona(db, c.empresaId, "recepcion");
    await moverStock(db, { empresaId: c.empresaId, productoId: p.id, desdeId: null, haciaId: rec.id, cantidad: 4, motivo: "recepcion" });
    const ped = await pedido([{ codigo: "RES-4", cantidad: 3 }]);
    expect((await lineaDe(ped.id)).reservado).toBe(0);
    await mover(c, { origen: "RECEPCION", producto: "RES-4", destino: "A-01-2", cantidad: 2 });
    expect((await lineaDe(ped.id)).reservado).toBe(2);
    await mover(c, { origen: "RECEPCION", producto: "RES-4", destino: "A-01-2", cantidad: 2 });
    expect((await lineaDe(ped.id)).reservado).toBe(3); // no pasa de lo que pidió
    expect(await resumen(p.id)).toMatchObject({ vendible: 4, comprometido: 3, disponible: 1 });
  });

  it("reparte el stock que aparece entre los pedidos pendientes, el más viejo primero", async () => {
    const p = await titulo("RES-5", 0);
    const vieja = await pedido([{ codigo: "RES-5", cantidad: 2 }]);
    const nueva = await pedido([{ codigo: "RES-5", cantidad: 2 }]);
    await moverStock(db, { empresaId: c.empresaId, productoId: p.id, desdeId: null, haciaId: estante["A-02-1"], cantidad: 3, motivo: "inicial" });
    await asignarReservas(db, c.empresaId, [p.id]);
    expect((await lineaDe(vieja.id)).reservado).toBe(2);
    expect((await lineaDe(nueva.id)).reservado).toBe(1);
  });

  it("cancelar un pedido suelta lo apartado; uno ya empezado no se cancela", async () => {
    const p = await titulo("RES-6", 5);
    const a = await pedido([{ codigo: "RES-6", cantidad: 4 }]);
    expect((await resumen(p.id)).disponible).toBe(1);
    await cancelarPedido(c, a.id);
    expect(await resumen(p.id)).toMatchObject({ comprometido: 0, disponible: 5 });
    expect((await db.select().from(pedidos).where(eq(pedidos.id, a.id)))[0].estado).toBe("cancelado");

    const b = await pedido([{ codigo: "RES-6", cantidad: 1 }]);
    await tomarPedido(c, b.id);
    await expect(cancelarPedido(c, b.id)).rejects.toThrow(/todavía no empezó/);
  });
});

describe("picking con reservas", () => {
  it("tomar un libro del estante no cambia lo disponible: sale de vendible y de comprometido a la vez", async () => {
    const p = await titulo("PK-1", 6);
    const ped = await pedido([{ codigo: "PK-1", cantidad: 4 }]);
    const antes = await resumen(p.id);
    expect(antes).toMatchObject({ vendible: 6, comprometido: 4, disponible: 2 });
    await tomarPedido(c, ped.id);
    const [tarea] = await db.select().from(tareasPicking).where(eq(tareasPicking.pedidoId, ped.id));
    expect(tarea.cantidad).toBe(4);
    await confirmarPick(c, { tareaId: tarea.id, ubicacion: "A-01-1", producto: "PK-1", cantidad: 3 });
    const medio = await resumen(p.id);
    expect(medio).toMatchObject({ vendible: 3, comprometido: 1, disponible: 2 });
    await confirmarPick(c, { tareaId: tarea.id, ubicacion: "A-01-1", producto: "PK-1", cantidad: 1 });
    expect(await resumen(p.id)).toMatchObject({ vendible: 2, comprometido: 0, disponible: 2 });
    expect((await lineaDe(ped.id)).reservado).toBe(0);
  });

  it("lo que no se pudo reservar queda como faltante y el resto del pedido sigue", async () => {
    const p = await titulo("PK-2", 2);
    const ped = await pedido([{ codigo: "PK-2", cantidad: 5 }]);
    await tomarPedido(c, ped.id);
    const tareas = await db.select().from(tareasPicking).where(eq(tareasPicking.pedidoId, ped.id));
    expect(tareas.find((t) => t.estado === "pendiente")?.cantidad).toBe(2);
    const falta = tareas.find((t) => t.estado === "faltante");
    expect(falta).toMatchObject({ cantidad: 3, ubicacionId: null });
    expect((await resumen(p.id)).comprometido).toBe(2);
  });

  it("si el operario no encuentra el libro en el estante, la reserva se suelta", async () => {
    const p = await titulo("PK-3", 2);
    const ped = await pedido([{ codigo: "PK-3", cantidad: 2 }]);
    await tomarPedido(c, ped.id);
    const [tarea] = await db.select().from(tareasPicking).where(eq(tareasPicking.pedidoId, ped.id));
    await marcarFaltante(c, tarea.id);
    expect((await resumen(p.id)).comprometido).toBe(0);
    expect((await lineaDe(ped.id)).reservado).toBe(0);
  });

  it("registra cuándo se tomó, preparó, empacó y despachó el pedido", async () => {
    await titulo("PK-4", 2);
    const ped = await pedido([{ codigo: "PK-4", cantidad: 1 }]);
    await tomarPedido(c, ped.id);
    const [tarea] = await db.select().from(tareasPicking).where(eq(tareasPicking.pedidoId, ped.id));
    await confirmarPick(c, { tareaId: tarea.id, ubicacion: "A-01-1", producto: "PK-4", cantidad: 1 });
    await escanearEnCaja(c, ped.id, "PK-4", 1);
    const [caja] = await db.query.cajas.findMany({ where: (k, { eq }) => eq(k.pedidoId, ped.id) });
    await cerrarCaja(c, caja.id);
    await finalizarEmpaque(c, ped.id);
    await marcarEnviado(c, empresa, "pedido", ped.id);
    const [f] = await db.select().from(pedidos).where(eq(pedidos.id, ped.id));
    for (const campo of ["tomadoEn", "preparadoEn", "empacadoEn", "despachadoEn"] as const) expect(f[campo], campo).toBeInstanceOf(Date);
    expect(f.tomadoEn!.getTime()).toBeLessThanOrEqual(f.preparadoEn!.getTime());
    expect(f.preparadoEn!.getTime()).toBeLessThanOrEqual(f.empacadoEn!.getTime());
    expect(f.empacadoEn!.getTime()).toBeLessThanOrEqual(f.despachadoEn!.getTime());
  });
});

describe("escaneos que no se repiten", () => {
  const cuenta = async (recepcionId: number, codigo: string) => {
    const [p] = await db.select().from(productos).where(and(eq(productos.empresaId, c.empresaId), eq(productos.codigoInterno, codigo)));
    const [l] = await db.query.recepcionLineas.findMany({ where: (x, { and, eq }) => and(eq(x.recepcionId, recepcionId), eq(x.productoId, p.id)) });
    return l?.recibido ?? 0;
  };

  it("la misma clave se aplica una sola vez y devuelve el mismo mensaje", async () => {
    await titulo("ID-1", 0);
    const rec = await crearRecepcionSinAviso(c, "Imprenta");
    const clave = crypto.randomUUID();
    const primero = await escanearRecepcion({ ...c, clave }, rec, "ID-1", 2);
    const repetido = await escanearRecepcion({ ...c, clave }, rec, "ID-1", 2);
    expect(repetido).toBe(primero);
    expect(await cuenta(rec, "ID-1")).toBe(2);
    await escanearRecepcion({ ...c, clave: crypto.randomUUID() }, rec, "ID-1", 2); // otra clave: es otro escaneo
    expect(await cuenta(rec, "ID-1")).toBe(4);
  });

  it("dos envíos simultáneos con la misma clave suman una vez", async () => {
    await titulo("ID-2", 0);
    const rec = await crearRecepcionSinAviso(c, "Imprenta");
    const clave = crypto.randomUUID();
    await Promise.all([escanearRecepcion({ ...c, clave }, rec, "ID-2", 3), escanearRecepcion({ ...c, clave }, rec, "ID-2", 3)]);
    expect(await cuenta(rec, "ID-2")).toBe(3);
  });

  it("un escaneo rechazado no gasta la clave: se puede reintentar", async () => {
    await titulo("ID-3", 0);
    const rec = await crearRecepcionSinAviso(c, "Imprenta");
    const clave = crypto.randomUUID();
    await expect(escanearRecepcion({ ...c, clave }, rec, "NO-EXISTE", 1)).rejects.toBeInstanceOf(ErrorUsuario);
    await escanearRecepcion({ ...c, clave }, rec, "ID-3", 1);
    expect(await cuenta(rec, "ID-3")).toBe(1);
  });

  it("sin clave todo sigue funcionando como antes", async () => {
    await titulo("ID-4", 0);
    const rec = await crearRecepcionSinAviso(c, "Imprenta");
    await escanearRecepcion(c, rec, "ID-4", 1);
    await escanearRecepcion(c, rec, "ID-4", 1);
    expect(await cuenta(rec, "ID-4")).toBe(2);
  });
});

describe("errores de escaneo", () => {
  it("distingue el libro equivocado y el estante equivocado", async () => {
    await titulo("ER-1", 3);
    await titulo("ER-2", 3);
    const ped = await pedido([{ codigo: "ER-1", cantidad: 1 }]);
    await tomarPedido(c, ped.id);
    const [tarea] = await db.select().from(tareasPicking).where(eq(tareasPicking.pedidoId, ped.id));
    const tipo = async (d: { ubicacion: string; producto: string }) => {
      try {
        await confirmarPick(c, { tareaId: tarea.id, cantidad: 1, ...d });
      } catch (e) {
        return e instanceof ErrorUsuario ? e.tipo : "no era ErrorUsuario";
      }
      return "sin error";
    };
    expect(await tipo({ ubicacion: "A-01-1", producto: "ER-2" })).toBe("titulo_equivocado");
    expect(await tipo({ ubicacion: "A-02-1", producto: "ER-1" })).toBe("ubicacion_equivocada");
    expect(await tipo({ ubicacion: "A-01-1", producto: "9999999999999" })).toBe("codigo_desconocido");
  });

  it("deja el registro aunque la operación se haya deshecho", async () => {
    await registrarErrorEscaneo(db, { empresaId: c.empresaId, usuarioId: c.usuarioId, flujo: "picking", error: new ErrorUsuario("Ese es otro libro", "titulo_equivocado"), detalle: { producto: "X" } });
    const filas = await db.select().from(erroresEscaneo).where(and(eq(erroresEscaneo.empresaId, c.empresaId), eq(erroresEscaneo.flujo, "picking")));
    expect(filas.at(-1)).toMatchObject({ tipo: "titulo_equivocado", mensaje: "Ese es otro libro", detalle: { producto: "X" } });
  });
});

describe("libro de movimientos", () => {
  it("no se puede modificar ni borrar, solo agregar", async () => {
    const [m] = await db.select().from(movimientos).where(eq(movimientos.empresaId, c.empresaId)).limit(1);
    const motivo = async (op: () => Promise<unknown>) => {
      try {
        await op();
      } catch (e) {
        const causa = (e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message;
        return causa;
      }
      return "sin error";
    };
    expect(await motivo(() => db.update(movimientos).set({ cantidad: 999 }).where(eq(movimientos.id, m.id)))).toMatch(/solo agregar/);
    expect(await motivo(() => db.delete(movimientos).where(eq(movimientos.id, m.id)))).toMatch(/solo agregar/);
    expect((await db.select().from(movimientos).where(eq(movimientos.id, m.id)))[0].cantidad).toBe(m.cantidad);
  });
});

describe("altas a mano y modo independiente", () => {
  it("valida el ISBN y no deja que dos títulos compartan un código", async () => {
    expect(ean13Valido("9789871234567")).toBe(false);
    expect(ean13Valido("9780306406157")).toBe(true);
    await expect(crearProducto(c, { titulo: "Malo", codigoInterno: "MAL-1", isbn: "9789871234567" })).rejects.toThrow(/no es válido/);
    await crearProducto(c, { titulo: "Bueno", codigoInterno: "BUE-1", isbn: "978-0-306-40615-7" });
    await expect(crearProducto(c, { titulo: "Otro", codigoInterno: "OTRO-1", codigoBarras: "9780306406157" })).rejects.toThrow(/Ya existe "Bueno"/);
    await expect(crearProducto(c, { titulo: "Otro", codigoInterno: "bue-1" })).rejects.toThrow(/Ya existe/);
  });

  it("lo cargado a mano tiene origen manual y una sincronización con Fierro no lo toca", async () => {
    const p = await titulo("MAN-1", 2);
    const ped = await pedido([{ codigo: "MAN-1", cantidad: 1 }]);
    expect(p).toMatchObject({ origen: "manual", idExterno: null });
    await db.update((await import("@/db/schema")).empresas).set({ simTitulos: 20, simClientes: 3, simPedidos: 2, simIngresos: 1 }).where(eq((await import("@/db/schema")).empresas.id, c.empresaId));
    const [e] = await db.select().from((await import("@/db/schema")).empresas).where(eq((await import("@/db/schema")).empresas.id, c.empresaId));
    await sincronizar(db, e);
    await sincronizar(db, e); // dos veces: no duplica
    const manual = await db.select().from(productos).where(and(eq(productos.empresaId, c.empresaId), eq(productos.origen, "manual"), eq(productos.codigoInterno, "MAN-1")));
    expect(manual).toHaveLength(1);
    expect((await db.select().from(pedidos).where(eq(pedidos.id, ped.id)))[0]).toMatchObject({ origen: "manual", estado: "pendiente" });
    expect((await db.select().from(productos).where(and(eq(productos.empresaId, c.empresaId), eq(productos.origen, "fierro")))).length).toBe(20);
    expect((await db.select().from(pedidos).where(and(eq(pedidos.empresaId, c.empresaId), eq(pedidos.origen, "fierro")))).length).toBe(2);
    expect((await db.select().from(recepciones).where(and(eq(recepciones.empresaId, c.empresaId), eq(recepciones.origen, "fierro")))).length).toBe(1);
  });
});

describe("módulos por empresa", () => {
  it("sin configuración todo está encendido, salvo Fierro en una empresa independiente", () => {
    expect(moduloActivo({ modo: "fierro", modulos: null }, "picking")).toBe(true);
    expect(moduloActivo({ modo: "fierro", modulos: null }, "fierro")).toBe(true);
    expect(moduloActivo({ modo: "independiente", modulos: null }, "fierro")).toBe(false);
    expect(moduloActivo({ modo: "independiente", modulos: null }, "picking")).toBe(true);
  });
  it("lo que el administrador fijó manda sobre el modo", () => {
    expect(moduloActivo({ modo: "fierro", modulos: { picking: false } }, "picking")).toBe(false);
    expect(moduloActivo({ modo: "independiente", modulos: { fierro: true } }, "fierro")).toBe(true);
    expect(moduloActivo({ modo: "fierro", modulos: { picking: false } }, "empaque")).toBe(true);
  });
});
