import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { Encabezado, Insignia, plural, Vacio } from "@/components/ui";
import { clientes, pedidoLineas, pedidos } from "@/db/schema";
import { requerir } from "@/lib/sesion";

export const metadata = { title: "Empaque" };

export default async function Empaque() {
  const { db, empresa } = await requerir();
  const filas = await db
    .select({
      p: pedidos,
      cliente: clientes.nombre,
      pickeado: sql<number>`coalesce(sum(${pedidoLineas.pickeado}), 0)`.mapWith(Number),
      empacado: sql<number>`coalesce(sum(${pedidoLineas.empacado}), 0)`.mapWith(Number),
      pedido: sql<number>`coalesce(sum(${pedidoLineas.cantidad}), 0)`.mapWith(Number),
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .leftJoin(pedidoLineas, eq(pedidoLineas.pedidoId, pedidos.id))
    .where(and(eq(pedidos.empresaId, empresa.id), eq(pedidos.estado, "preparado")))
    .groupBy(pedidos.id, clientes.nombre)
    .orderBy(asc(pedidos.fecha));

  return (
    <>
      <Encabezado titulo="Empaque" />
      {filas.length === 0 ? (
        <Vacio icono="empaque" titulo="No hay pedidos esperando empaque">
          Cuando alguien termine un picking, el pedido aparece acá.
        </Vacio>
      ) : (
        <div className="overflow-x-auto border-y border-borde">
          <table className="tabla">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th className="hidden text-right sm:table-cell">Preparadas</th>
                <th className="hidden text-right sm:table-cell">Faltantes</th>
                <th>Cajas</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ p, cliente, pickeado, empacado, pedido }) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/empaque/${p.id}`} className="enlace numero">
                      {p.numero}
                    </Link>
                  </td>
                  <td>
                    <span className="font-medium">{cliente}</span>
                    <span className="block text-suave sm:hidden">
                      {plural(pickeado, "unidad preparada", "unidades preparadas")}
                      {pickeado < pedido && ` · ${pedido - pickeado} faltantes`}
                    </span>
                  </td>
                  <td className="hidden text-right font-semibold sm:table-cell">{pickeado}</td>
                  <td className={`hidden text-right sm:table-cell ${pickeado < pedido ? "font-semibold text-peligro" : "text-suave"}`}>{pickeado < pedido ? pedido - pickeado : "—"}</td>
                  <td>
                    {empacado > 0 ? (
                      <Insignia tono="acento">
                        {empacado} de {pickeado} en cajas
                      </Insignia>
                    ) : (
                      <Insignia>Sin empezar</Insignia>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
