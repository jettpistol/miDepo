import { ErrorUsuario } from "../errores";
import { buscarProducto, buscarUbicacion, moverStock } from "../stock";
import { asignarReservas } from "../reservas";
import { cantidadValida, unaVez, type Ctx } from "./comun";

/** Pasa unidades de una ubicación a otra. Guardar lo recibido es el mismo movimiento desde Recepción. */
export async function mover(c: Ctx, d: { origen: string; producto: string; destino: string; cantidad: unknown }) {
  const n = cantidadValida(d.cantidad);
  return unaVez(c, async (cx) => {
    const origen = await buscarUbicacion(cx.db, cx.empresaId, d.origen);
    const p = await buscarProducto(cx.db, cx.empresaId, d.producto);
    const destino = await buscarUbicacion(cx.db, cx.empresaId, d.destino);
    if (origen.tipo === "preparacion" || destino.tipo === "preparacion") {
      throw new ErrorUsuario("Los pedidos preparados no se mueven a mano: salen cuando se despacha el pedido.");
    }
    const guardado = origen.tipo === "recepcion" || origen.tipo === "devoluciones";
    await moverStock(cx.db, { empresaId: cx.empresaId, productoId: p.id, desdeId: origen.id, haciaId: destino.id, cantidad: n, motivo: guardado ? "guardado" : "movimiento", usuarioId: cx.usuarioId });
    // Lo que llega a una estantería se puede vender: si hay pedidos esperando ese título, lo apartan.
    if (destino.tipo === "estanteria") await asignarReservas(cx.db, cx.empresaId, [p.id]);
    return `${n} × ${p.titulo}: ${origen.codigo} → ${destino.codigo}`;
  });
}
