import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Formulario } from "@/components/Escaneo";
import { Encabezado, fechaCorta, Insignia, plural } from "@/components/ui";
import { clientes, devolucionLineas, devoluciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { crear } from "./acciones";
import { ElegirCliente } from "./ElegirCliente";

export const metadata = { title: "Devoluciones" };

export default async function Devoluciones() {
  const { db, empresa } = await requerir();
  const [lista, filas] = await Promise.all([
    db.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes).where(eq(clientes.empresaId, empresa.id)).orderBy(asc(clientes.nombre)),
    db
      .select({ d: devoluciones, cliente: clientes.nombre, unidades: sql<number>`coalesce(sum(${devolucionLineas.cantidad}), 0)`.mapWith(Number) })
      .from(devoluciones)
      .innerJoin(clientes, eq(clientes.id, devoluciones.clienteId))
      .leftJoin(devolucionLineas, eq(devolucionLineas.devolucionId, devoluciones.id))
      .where(eq(devoluciones.empresaId, empresa.id))
      .groupBy(devoluciones.id, clientes.nombre)
      .orderBy(desc(devoluciones.fecha))
      .limit(40),
  ]);

  return (
    <>
      <Encabezado titulo="Devoluciones" />
      <section className="mb-9">
        <h2 className="titulo-seccion">Llegó una devolución</h2>
        <Formulario accion={crear} boton="Empezar a revisar" clase="flex flex-wrap items-start gap-3">
          <ElegirCliente clientes={lista} />
        </Formulario>
      </section>

      {filas.length > 0 && (
        <section>
          <h2 className="titulo-seccion">
            Últimas devoluciones <small>{filas.length}</small>
          </h2>
          <div className="overflow-x-auto border-y border-borde">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Devolución</th>
                  <th>Cliente</th>
                  <th className="hidden text-right sm:table-cell">Unidades</th>
                  <th className="hidden sm:table-cell">Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ d, cliente, unidades }) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/devoluciones/${d.id}`} className="enlace numero">
                        {d.numero}
                      </Link>
                    </td>
                    <td>
                      <span className="font-medium">{cliente}</span>
                      <span className="block text-suave sm:hidden">
                        {plural(unidades, "unidad", "unidades")} · {fechaCorta(d.fecha)}
                      </span>
                    </td>
                    <td className="hidden text-right font-semibold sm:table-cell">{unidades}</td>
                    <td className="hidden whitespace-nowrap text-suave sm:table-cell">{fechaCorta(d.fecha)}</td>
                    <td>{d.estado === "en_curso" ? <Insignia tono="acento">En curso</Insignia> : <Insignia tono="ok">Cerrada</Insignia>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
