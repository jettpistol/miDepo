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
      <Encabezado titulo="Empaque" bajada="Armá las cajas de los pedidos ya preparados. Cada libro se escanea al entrar a la caja." />
      {filas.length === 0 ? (
        <Vacio icono="empaque" titulo="No hay pedidos esperando empaque">
          Cuando alguien termine un picking, el pedido aparece acá.
        </Vacio>
      ) : (
        <ul className="space-y-2">
          {filas.map(({ p, cliente, pickeado, empacado, pedido }) => (
            <li key={p.id}>
              <Link href={`/empaque/${p.id}`} className="tarjeta flex flex-wrap items-center justify-between gap-2 p-4 hover:border-acento-texto/50">
                <span>
                  <span className="block font-semibold">
                    {p.numero} · {cliente}
                  </span>
                  <span className="block text-sm text-suave">
                    {plural(pickeado, "unidad preparada", "unidades preparadas")}
                    {pickeado < pedido && ` · ${pedido - pickeado} faltantes`}
                  </span>
                </span>
                {empacado > 0 ? (
                  <Insignia tono="acento">
                    {empacado} de {pickeado} en cajas
                  </Insignia>
                ) : (
                  <Insignia>Sin empezar</Insignia>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
