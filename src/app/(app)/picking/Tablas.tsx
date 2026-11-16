import Link from "next/link";
import { and, asc, eq, inArray, min, sql } from "drizzle-orm";
import { BotonAccion } from "@/components/Escaneo";
import { Avance, fechaCorta, Insignia, Tejuelo } from "@/components/ui";
import { clientes, pedidoLineas, pedidos, tareasPicking, ubicaciones, usuarios } from "@/db/schema";
import type { requerir } from "@/lib/sesion";
import { tomar } from "./acciones";

type Db = Awaited<ReturnType<typeof requerir>>["db"];

/** Pedidos pendientes y en preparación, con el próximo estante de cada recorrido. */
export async function pedidosAbiertos(db: Db, empresaId: number) {
  const filas = await db
    .select({
      p: pedidos,
      cliente: clientes.nombre,
      localidad: clientes.localidad,
      tomadoPor: usuarios.nombre,
      lineas: sql<number>`count(${pedidoLineas.id})`.mapWith(Number),
      unidades: sql<number>`coalesce(sum(${pedidoLineas.cantidad}), 0)`.mapWith(Number),
      pickeado: sql<number>`coalesce(sum(${pedidoLineas.pickeado}), 0)`.mapWith(Number),
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .leftJoin(usuarios, eq(usuarios.id, pedidos.tomadoPor))
    .leftJoin(pedidoLineas, eq(pedidoLineas.pedidoId, pedidos.id))
    .where(and(eq(pedidos.empresaId, empresaId), inArray(pedidos.estado, ["pendiente", "en_preparacion"])))
    .groupBy(pedidos.id, clientes.nombre, clientes.localidad, usuarios.nombre)
    .orderBy(asc(pedidos.fecha))
    .limit(200);
  const enCurso = filas.filter((f) => f.p.estado === "en_preparacion");
  const pendientes = filas.filter((f) => f.p.estado === "pendiente");

  const proximo = new Map<number, string | null>();
  if (enCurso.length > 0) {
    const paradas = await db
      .select({ pedidoId: tareasPicking.pedidoId, codigo: min(ubicaciones.codigo) })
      .from(tareasPicking)
      .innerJoin(ubicaciones, eq(ubicaciones.id, tareasPicking.ubicacionId))
      .where(and(eq(tareasPicking.estado, "pendiente"), inArray(tareasPicking.pedidoId, enCurso.map((f) => f.p.id))))
      .groupBy(tareasPicking.pedidoId);
    for (const x of paradas) proximo.set(x.pedidoId, x.codigo);
  }
  return { enCurso: enCurso.map((f) => ({ ...f, proximo: proximo.get(f.p.id) ?? null })), pendientes };
}

type Abiertos = Awaited<ReturnType<typeof pedidosAbiertos>>;

/** Cada pedido en preparación empieza por el tejuelo del estante al que va ahora. */
export function EnPreparacion({ filas, usuarioId }: { filas: Abiertos["enCurso"]; usuarioId: number }) {
  return (
    <div className="overflow-x-auto border-y border-borde">
      <table className="tabla">
        <thead>
          <tr>
            <th>Próximo estante</th>
            <th>Pedido</th>
            <th className="hidden sm:table-cell">Quién</th>
            <th className="hidden w-[30%] min-w-36 sm:table-cell">Avance</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ p, cliente, tomadoPor, unidades, pickeado, proximo }) => (
            <tr key={p.id} className={p.tomadoPor === usuarioId ? "bg-acento-suave" : ""}>
              <td>{proximo ? <Tejuelo codigo={proximo} tam="md" /> : <Insignia tono="ok">Recorrido terminado</Insignia>}</td>
              <td>
                <Link href={`/picking/${p.id}`} className="enlace numero">
                  {p.numero}
                </Link>
                <span className="block max-w-40 truncate text-suave sm:max-w-64">{cliente}</span>
                <span className="block text-suave sm:hidden">
                  {pickeado} de {unidades} · {p.tomadoPor === usuarioId ? "vos" : (tomadoPor ?? "otra persona")}
                </span>
              </td>
              <td className="hidden sm:table-cell">{p.tomadoPor === usuarioId ? <strong>Vos</strong> : (tomadoPor ?? "Otra persona")}</td>
              <td className="hidden sm:table-cell">
                <Avance hecho={pickeado} total={unidades} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pendientes({ filas }: { filas: Abiertos["pendientes"] }) {
  return (
    <div className="overflow-x-auto border-y border-borde">
      <table className="tabla">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th className="hidden md:table-cell">Localidad</th>
            <th className="hidden text-right sm:table-cell">Títulos</th>
            <th className="hidden text-right sm:table-cell">Unidades</th>
            <th className="hidden md:table-cell">Llegó</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filas.map(({ p, cliente, localidad, lineas, unidades }) => (
            <tr key={p.id}>
              <td>
                <Link href={`/picking/${p.id}`} className="enlace numero">
                  {p.numero}
                </Link>
              </td>
              <td>
                <span className="font-medium">{cliente}</span>
                {p.modalidad === "consignacion" && (
                  <>
                    {" "}
                    <Insignia>Consignación</Insignia>
                  </>
                )}
                <span className="block text-suave md:hidden">
                  <span className="sm:hidden">{unidades} u. · </span>
                  {localidad}
                </span>
              </td>
              <td className="hidden text-suave md:table-cell">{localidad}</td>
              <td className="hidden text-right sm:table-cell">{lineas}</td>
              <td className="hidden text-right font-semibold sm:table-cell">{unidades}</td>
              <td className="hidden whitespace-nowrap text-suave md:table-cell">{fechaCorta(p.fecha)}</td>
              <td className="w-px text-right">
                <BotonAccion accion={tomar} ocultos={{ id: p.id }} mostrarOk={false} clase="boton-chico">
                  Preparar
                </BotonAccion>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
