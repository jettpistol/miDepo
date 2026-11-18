import { and, asc, count, eq, or } from "drizzle-orm";
import { clientes, pedidoLineas, pedidos, productos, type TipoProducto } from "@/db/schema";
import { ErrorUsuario } from "../errores";
import { liberarReserva, reservarPedido } from "../reservas";
import { buscarProducto } from "../stock";
import { cantidadValida, type Ctx } from "./comun";

/**
 * Altas a mano: catálogo, clientes y pedidos que no vienen de un ERP. Es lo que usa una empresa
 * "independiente", y también sirve a una con Fierro para lo que Fierro todavía no tiene.
 * Lo cargado a mano tiene origen "manual" y nunca lo pisa una sincronización.
 */

/** Un ISBN-13 / EAN-13 es válido si su dígito de control cierra. */
export function ean13Valido(codigo: string) {
  if (!/^\d{13}$/.test(codigo)) return false;
  const suma = [...codigo.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (suma % 10)) % 10 === Number(codigo[12]);
}

export async function crearProducto(
  c: Ctx,
  d: { titulo: string; codigoInterno: string; isbn?: string; codigoBarras?: string; autor?: string; sello?: string; tipo?: TipoProducto; pesoGramos?: number; precio?: number },
) {
  const titulo = d.titulo.trim();
  const interno = d.codigoInterno.trim().toUpperCase();
  const isbn = d.isbn?.replace(/[\s-]/g, "") || null;
  if (!titulo) throw new ErrorUsuario("Escribí el título.");
  if (!interno) throw new ErrorUsuario("Escribí el código interno (por ejemplo OVN-AKIRA-04).");
  if (isbn && !ean13Valido(isbn)) throw new ErrorUsuario(`El ISBN ${isbn} no es válido: revisá los 13 dígitos.`);
  const barras = (d.codigoBarras?.trim() || isbn || interno).toString();
  const peso = d.pesoGramos ?? 300;
  if (!Number.isInteger(peso) || peso <= 0) throw new ErrorUsuario("El peso tiene que ser un número de gramos mayor que cero.");

  // Cada código tiene que apuntar a un solo título, o el lector no sabría cuál es.
  const codigos = [...new Set([barras, interno, ...(isbn ? [isbn] : [])])];
  const choque = await c.db
    .select({ titulo: productos.titulo, interno: productos.codigoInterno })
    .from(productos)
    .where(and(eq(productos.empresaId, c.empresaId), or(...codigos.flatMap((k) => [eq(productos.codigoBarras, k), eq(productos.isbn, k), eq(productos.codigoInterno, k)]))))
    .limit(1);
  if (choque.length > 0) throw new ErrorUsuario(`Ya existe "${choque[0].titulo}" (${choque[0].interno}) con ese código. Cada código tiene que ser de un solo título.`);

  const [p] = await c.db
    .insert(productos)
    .values({ empresaId: c.empresaId, origen: "manual", idExterno: null, codigoInterno: interno, isbn, codigoBarras: barras, titulo, autor: d.autor?.trim() || null, sello: d.sello?.trim() || null, tipo: d.tipo ?? "libro", precio: d.precio ?? 0, pesoGramos: peso })
    .returning();
  return p;
}

export async function crearCliente(c: Ctx, d: { nombre: string; direccion?: string; localidad?: string; provincia?: string }) {
  const nombre = d.nombre.trim();
  if (!nombre) throw new ErrorUsuario("Escribí el nombre del cliente.");
  const [cli] = await c.db
    .insert(clientes)
    .values({ empresaId: c.empresaId, origen: "manual", idExterno: null, nombre, direccion: d.direccion?.trim() || null, localidad: d.localidad?.trim() || null, provincia: d.provincia?.trim() || null })
    .returning();
  return cli;
}

/**
 * Carga un pedido a mano. Cada línea trae el código que lee el lector (ISBN, código de barras o
 * interno) y una cantidad. Al entrar, el pedido aparta el stock que haya; lo que falte queda como saldo.
 */
export async function crearPedidoManual(c: Ctx, d: { clienteId: number; modalidad?: "firme" | "consignacion"; lineas: { codigo: string; cantidad: unknown }[] }) {
  if (d.lineas.length === 0) throw new ErrorUsuario("El pedido necesita al menos un libro.");
  return c.db.transaction(async (tx) => {
    const [cli] = await tx.select().from(clientes).where(and(eq(clientes.id, d.clienteId), eq(clientes.empresaId, c.empresaId)));
    if (!cli) throw new ErrorUsuario("Elegí un cliente de la lista.");
    // Si un título aparece dos veces, se suman: una línea por título.
    const porTitulo = new Map<number, number>();
    for (const l of d.lineas) {
      const p = await buscarProducto(tx, c.empresaId, l.codigo);
      porTitulo.set(p.id, (porTitulo.get(p.id) ?? 0) + cantidadValida(l.cantidad));
    }
    const [{ n }] = await tx.select({ n: count() }).from(pedidos).where(and(eq(pedidos.empresaId, c.empresaId), eq(pedidos.origen, "manual")));
    const numero = `PED-${String(n + 1).padStart(4, "0")}`;
    const [ped] = await tx.insert(pedidos).values({ empresaId: c.empresaId, origen: "manual", idExterno: null, numero, clienteId: cli.id, modalidad: d.modalidad ?? "firme" }).returning();
    await tx.insert(pedidoLineas).values([...porTitulo].map(([productoId, cantidad]) => ({ pedidoId: ped.id, productoId, cantidad })));
    const apartadas = await reservarPedido(tx, c.empresaId, ped.id);
    const pedidas = [...porTitulo.values()].reduce((s, x) => s + x, 0);
    return { id: ped.id, numero, mensaje: apartadas === pedidas ? `Pedido ${numero} cargado con todo el stock apartado.` : `Pedido ${numero} cargado. Hay stock para ${apartadas} de ${pedidas} unidades; el resto queda como saldo pendiente.` };
  });
}

/** Cancela un pedido que todavía nadie empezó a preparar y suelta lo que tenía apartado. */
export async function cancelarPedido(c: Ctx, pedidoId: number) {
  return c.db.transaction(async (tx) => {
    const [p] = await tx.select().from(pedidos).where(and(eq(pedidos.id, pedidoId), eq(pedidos.empresaId, c.empresaId)));
    if (!p) throw new ErrorUsuario("No encuentro ese pedido.");
    if (p.estado !== "pendiente") throw new ErrorUsuario("Solo se puede cancelar un pedido que todavía no empezó a prepararse. Si ya tiene libros tomados, hay que devolverlos al estante primero.");
    const marcado = await tx.update(pedidos).set({ estado: "cancelado" }).where(and(eq(pedidos.id, pedidoId), eq(pedidos.estado, "pendiente"))).returning({ id: pedidos.id });
    if (marcado.length === 0) throw new ErrorUsuario("Ese pedido acaba de cambiar de estado. Volvé a mirarlo.");
    // En orden de título, igual que al reservar, para que dos procesos no se traben entre sí.
    const lineas = await tx.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, pedidoId)).orderBy(asc(pedidoLineas.productoId));
    let sueltas = 0;
    for (const l of lineas) sueltas += await liberarReserva(tx, c.empresaId, l.id, l.reservado);
    return `Pedido ${p.numero} cancelado. ${sueltas} unidades volvieron a estar disponibles.`;
  });
}
