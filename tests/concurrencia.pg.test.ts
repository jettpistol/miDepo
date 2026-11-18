/**
 * Pruebas de concurrencia contra un Postgres de verdad. La base embebida (PGlite) tiene una sola
 * conexión y ejecuta todo en fila, así que no puede demostrar que los bloqueos funcionan.
 *
 * Se saltean solas si no hay base. Para correrlas:
 *   TEST_DATABASE_URL=postgres://usuario@localhost:5432/midepo_test npx vitest run tests/concurrencia.pg.test.ts
 * La base tiene que existir y puede estar vacía; las pruebas crean su propia empresa.
 */
import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

const URL = process.env.TEST_DATABASE_URL;
if (URL) {
  process.env.DATABASE_URL = URL;
  process.env.SECRETO ??= "prueba";
}

import { getDb, migrar } from "@/db";
import { pedidoLineas, pedidos, recepcionLineas, ubicaciones } from "@/db/schema";
import { crearEmpresa, crearUsuario } from "@/db/seed";
import { moverStock } from "@/lib/stock";
import { resumenStock } from "@/lib/reservas";
import type { Ctx } from "@/lib/flujos/comun";
import { crearCliente, crearPedidoManual, crearProducto } from "@/lib/flujos/pedidos";
import { crearRecepcionSinAviso, escanearRecepcion } from "@/lib/flujos/recepcion";

describe.skipIf(!URL)("concurrencia en Postgres", () => {
  async function preparar() {
    await migrar();
    const db = await getDb();
    const slug = `conc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const empresa = await crearEmpresa(db, { nombre: slug, slug });
    const u = await crearUsuario(db, empresa.id, { nombre: "Prueba", email: `${slug}@prueba.test`, rol: "admin", clave: "clave-larga" });
    const c: Ctx = { db, empresaId: empresa.id, usuarioId: u.id };
    const [estante] = await db.insert(ubicaciones).values({ empresaId: empresa.id, codigo: "A-01-1" }).returning();
    const clienteId = (await crearCliente(c, { nombre: "Cliente" })).id;
    const titulo = async (codigo: string, cantidad: number) => {
      const p = await crearProducto(c, { titulo: codigo, codigoInterno: codigo });
      if (cantidad > 0) await moverStock(db, { empresaId: c.empresaId, productoId: p.id, desdeId: null, haciaId: estante.id, cantidad, motivo: "inicial" });
      return p;
    };
    const reservadoEn = async (productoId: number) => {
      const filas = await db.select({ r: pedidoLineas.reservado }).from(pedidoLineas).innerJoin(pedidos, eq(pedidos.id, pedidoLineas.pedidoId)).where(and(eq(pedidos.empresaId, c.empresaId), eq(pedidoLineas.productoId, productoId)));
      return filas.reduce((s, f) => s + f.r, 0);
    };
    return { db, c, clienteId, titulo, reservadoEn };
  }

  it("20 pedidos a la vez por el último ejemplar: se aparta exactamente 1", async () => {
    const { c, clienteId, titulo, reservadoEn, db } = await preparar();
    const p = await titulo("ULT-1", 1);
    await Promise.all(Array.from({ length: 20 }, () => crearPedidoManual(c, { clienteId, lineas: [{ codigo: "ULT-1", cantidad: 1 }] })));
    expect(await reservadoEn(p.id)).toBe(1);
    expect((await resumenStock(db, c.empresaId, [p.id])).get(p.id)).toMatchObject({ vendible: 1, comprometido: 1, disponible: 0 });
  });

  it("20 pedidos por 5 ejemplares: se apartan exactamente 5, nunca más", async () => {
    const { c, clienteId, titulo, reservadoEn } = await preparar();
    const p = await titulo("CIN-1", 5);
    await Promise.all(Array.from({ length: 20 }, () => crearPedidoManual(c, { clienteId, lineas: [{ codigo: "CIN-1", cantidad: 1 }] })));
    expect(await reservadoEn(p.id)).toBe(5);
  });

  it("pedidos con los mismos títulos en orden opuesto no se traban entre sí", async () => {
    const { c, clienteId, titulo, reservadoEn } = await preparar();
    const a = await titulo("CRZ-A", 10);
    const b = await titulo("CRZ-B", 10);
    await Promise.all(
      Array.from({ length: 16 }, (_, i) =>
        crearPedidoManual(c, { clienteId, lineas: i % 2 === 0 ? [{ codigo: "CRZ-A", cantidad: 1 }, { codigo: "CRZ-B", cantidad: 1 }] : [{ codigo: "CRZ-B", cantidad: 1 }, { codigo: "CRZ-A", cantidad: 1 }] }),
      ),
    );
    expect(await reservadoEn(a.id)).toBe(10);
    expect(await reservadoEn(b.id)).toBe(10);
  });

  it("el mismo escaneo enviado 8 veces a la vez con la misma clave suma una sola vez", async () => {
    const { c, db, titulo } = await preparar();
    const p = await titulo("CLV-1", 0);
    const rec = await crearRecepcionSinAviso(c, "Imprenta");
    const clave = crypto.randomUUID();
    await Promise.all(Array.from({ length: 8 }, () => escanearRecepcion({ ...c, clave }, rec, "CLV-1", 3)));
    const [l] = await db.select().from(recepcionLineas).where(and(eq(recepcionLineas.recepcionId, rec), eq(recepcionLineas.productoId, p.id)));
    expect(l.recibido).toBe(3);
  });
});
