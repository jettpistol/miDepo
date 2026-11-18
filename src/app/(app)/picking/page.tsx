import Link from "next/link";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { BotonAccion } from "@/components/Escaneo";
import { Encabezado, fechaCorta, Insignia, plural, Vacio } from "@/components/ui";
import { clientes, pedidoLineas, pedidos, usuarios } from "@/db/schema";
import { puede, requerir } from "@/lib/sesion";
import { cancelar, tomar } from "./acciones";

export const metadata = { title: "Picking" };

export default async function Picking() {
  const { db, empresa, usuario } = await requerir("operario", "picking");
  const filas = await db
    .select({
      p: pedidos,
      cliente: clientes.nombre,
      localidad: clientes.localidad,
      tomadoPor: usuarios.nombre,
      lineas: sql<number>`count(${pedidoLineas.id})`.mapWith(Number),
      unidades: sql<number>`coalesce(sum(${pedidoLineas.cantidad}), 0)`.mapWith(Number),
      pickeado: sql<number>`coalesce(sum(${pedidoLineas.pickeado}), 0)`.mapWith(Number),
      reservado: sql<number>`coalesce(sum(${pedidoLineas.reservado}), 0)`.mapWith(Number),
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .leftJoin(usuarios, eq(usuarios.id, pedidos.tomadoPor))
    .leftJoin(pedidoLineas, eq(pedidoLineas.pedidoId, pedidos.id))
    .where(and(eq(pedidos.empresaId, empresa.id), inArray(pedidos.estado, ["pendiente", "en_preparacion"])))
    .groupBy(pedidos.id, clientes.nombre, clientes.localidad, usuarios.nombre)
    .orderBy(asc(pedidos.fecha))
    .limit(200);
  const enCurso = filas.filter((f) => f.p.estado === "en_preparacion");
  const pendientes = filas.filter((f) => f.p.estado === "pendiente");

  return (
    <>
      <Encabezado titulo="Picking" bajada="Tomá un pedido y miDepo te lleva estante por estante. Primero los más viejos." />

      {enCurso.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-suave">En preparación</h2>
          <ul className="space-y-2">
            {enCurso.map(({ p, cliente, tomadoPor, unidades, pickeado }) => (
              <li key={p.id}>
                <Link href={`/picking/${p.id}`} className={`tarjeta flex flex-wrap items-center justify-between gap-2 p-4 hover:border-acento-texto/50 ${p.tomadoPor === usuario.id ? "border-acento-texto/40 bg-acento-suave" : ""}`}>
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {p.numero} · {cliente}
                    </span>
                    <span className="block text-sm text-suave">{p.tomadoPor === usuario.id ? "Lo estás preparando vos" : `Lo prepara ${tomadoPor ?? "otra persona"}`}</span>
                  </span>
                  <Insignia tono="acento">
                    {pickeado} de {unidades}
                  </Insignia>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-2 text-sm font-semibold text-suave">Pendientes ({pendientes.length})</h2>
      {pendientes.length === 0 ? (
        <Vacio titulo="No hay pedidos pendientes">Los pedidos nuevos aparecen apenas entran al sistema.</Vacio>
      ) : (
        <ul className="space-y-2">
          {pendientes.map(({ p, cliente, localidad, lineas, unidades, reservado }) => (
            <li key={p.id} className="tarjeta flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
              <span className="min-w-0 flex-1 basis-56">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {p.numero}
                  {p.modalidad === "consignacion" && <Insignia>Consignación</Insignia>}
                  {reservado >= unidades ? <Insignia tono="ok">Stock apartado</Insignia> : reservado > 0 ? <Insignia tono="alerta">Stock parcial: {reservado} de {unidades}</Insignia> : <Insignia tono="peligro">Sin stock apartado</Insignia>}
                </span>
                <span className="block truncate text-sm">{cliente}</span>
                <span className="block text-sm text-suave">
                  {plural(lineas, "título", "títulos")} · {plural(unidades, "unidad", "unidades")} · {localidad} · {fechaCorta(p.fecha)}
                </span>
              </span>
              {puede(usuario.rol, "supervisor") && (
                <BotonAccion accion={cancelar} ocultos={{ id: p.id }} clase="boton-suave" confirmar={`¿Cancelar el pedido ${p.numero}? El stock que tenía apartado queda libre.`} mostrarOk={false}>
                  Cancelar
                </BotonAccion>
              )}
              <BotonAccion accion={tomar} ocultos={{ id: p.id }} mostrarOk={false}>
                Preparar
              </BotonAccion>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
