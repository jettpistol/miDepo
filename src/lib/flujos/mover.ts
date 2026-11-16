import { ErrorUsuario } from "../errores";
import { buscarProducto, buscarUbicacion, moverStock } from "../stock";
import { cantidadValida, type Ctx } from "./comun";

/** Pasa unidades de una ubicación a otra. Guardar lo recibido es el mismo movimiento desde Recepción. */
export async function mover(c: Ctx, d: { origen: string; producto: string; destino: string; cantidad: unknown }) {
  const n = cantidadValida(d.cantidad);
  const origen = await buscarUbicacion(c.db, c.empresaId, d.origen);
  const p = await buscarProducto(c.db, c.empresaId, d.producto);
  const destino = await buscarUbicacion(c.db, c.empresaId, d.destino);
  if (origen.tipo === "preparacion" || destino.tipo === "preparacion") {
    throw new ErrorUsuario("Los pedidos preparados no se mueven a mano: salen cuando se despacha el pedido.");
  }
  const guardado = origen.tipo === "recepcion" || origen.tipo === "devoluciones";
  await c.db.transaction((tx) =>
    moverStock(tx, { empresaId: c.empresaId, productoId: p.id, desdeId: origen.id, haciaId: destino.id, cantidad: n, motivo: guardado ? "guardado" : "movimiento", usuarioId: c.usuarioId }),
  );
  return `${n} × ${p.titulo}: ${origen.codigo} → ${destino.codigo}`;
}
