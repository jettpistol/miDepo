import { and, count, eq, sql } from "drizzle-orm";
import { clientes, devolucionLineas, devoluciones, type EstadoLibro } from "@/db/schema";
import { ErrorUsuario } from "../errores";
import { buscarProducto, moverStock, zona } from "../stock";
import { cantidadValida, unaVez, type Ctx } from "./comun";

export const ESTADOS_LIBRO: { id: EstadoLibro; nombre: string; ayuda: string }[] = [
  { id: "vendible", nombre: "Vendible", ayuda: "Como nuevo. Vuelve a la estantería." },
  { id: "danado", nombre: "Dañado", ayuda: "Roto, mojado o muy marcado. No se vende." },
  { id: "saldo", nombre: "Saldo", ayuda: "Con detalles. Se vende con descuento." },
];

export async function crearDevolucion(c: Ctx, clienteId: number) {
  const [cli] = await c.db.select().from(clientes).where(and(eq(clientes.id, clienteId), eq(clientes.empresaId, c.empresaId)));
  if (!cli) throw new ErrorUsuario("Elegí un cliente de la lista.");
  const [{ n }] = await c.db.select({ n: count() }).from(devoluciones).where(eq(devoluciones.empresaId, c.empresaId));
  const [d] = await c.db.insert(devoluciones).values({ empresaId: c.empresaId, clienteId, numero: `DEV-${String(n + 1).padStart(4, "0")}` }).returning();
  return d.id;
}

async function abierta(c: Ctx, id: number) {
  const [d] = await c.db.select().from(devoluciones).where(and(eq(devoluciones.id, id), eq(devoluciones.empresaId, c.empresaId)));
  if (!d) throw new ErrorUsuario("No encuentro esa devolución.");
  if (d.estado === "cerrada") throw new ErrorUsuario("Esta devolución ya está cerrada.");
  return d;
}

export async function escanearDevolucion(c: Ctx, devolucionId: number, codigo: string, estadoLibro: string, cantidad: unknown) {
  const n = cantidadValida(cantidad);
  const estado = ESTADOS_LIBRO.find((e) => e.id === estadoLibro);
  if (!estado) throw new ErrorUsuario("Elegí en qué estado está el libro.");
  return unaVez(c, async (cx) => {
    await abierta(cx, devolucionId);
    const p = await buscarProducto(cx.db, cx.empresaId, codigo);
    await cx.db
      .insert(devolucionLineas)
      .values({ devolucionId, productoId: p.id, estadoLibro: estado.id, cantidad: n })
      .onConflictDoUpdate({ target: [devolucionLineas.devolucionId, devolucionLineas.productoId, devolucionLineas.estadoLibro], set: { cantidad: sql`${devolucionLineas.cantidad} + ${n}` } });
    return `${n} × ${p.titulo} → ${estado.nombre}`;
  });
}

export async function quitarLineaDevolucion(c: Ctx, devolucionId: number, productoId: number, estadoLibro: string) {
  await abierta(c, devolucionId);
  await c.db.delete(devolucionLineas).where(and(eq(devolucionLineas.devolucionId, devolucionId), eq(devolucionLineas.productoId, productoId), eq(devolucionLineas.estadoLibro, estadoLibro as EstadoLibro)));
  return "Línea quitada.";
}

/** Cierra la devolución: cada libro entra al stock en la zona que le toca según su estado. */
export async function cerrarDevolucion(c: Ctx, devolucionId: number) {
  const d = await abierta(c, devolucionId);
  return c.db.transaction(async (tx) => {
    const lineas = await tx.select().from(devolucionLineas).where(eq(devolucionLineas.devolucionId, devolucionId));
    if (lineas.length === 0) throw new ErrorUsuario("Todavía no escaneaste ningún libro.");
    const destino = { vendible: await zona(tx, c.empresaId, "devoluciones"), danado: await zona(tx, c.empresaId, "danados"), saldo: await zona(tx, c.empresaId, "saldos") };
    for (const l of lineas) {
      await moverStock(tx, { empresaId: c.empresaId, productoId: l.productoId, desdeId: null, haciaId: destino[l.estadoLibro].id, cantidad: l.cantidad, motivo: "devolucion", referencia: d.numero, usuarioId: c.usuarioId });
    }
    await tx.update(devoluciones).set({ estado: "cerrada" }).where(eq(devoluciones.id, devolucionId));
    const vendibles = lineas.filter((l) => l.estadoLibro === "vendible").reduce((s, l) => s + l.cantidad, 0);
    return `Devolución ${d.numero} cerrada. ${vendibles} unidades vendibles esperan para guardar.`;
  });
}
