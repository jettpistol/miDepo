import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Formulario } from "@/components/Escaneo";
import { Encabezado, fechaCorta, Insignia, plural, Vacio } from "@/components/ui";
import { recepcionLineas, recepciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { crear } from "./acciones";

export const metadata = { title: "Recepción" };

export default async function Recepciones() {
  const { db, empresa } = await requerir();
  const filas = await db
    .select({
      r: recepciones,
      titulos: sql<number>`count(${recepcionLineas.id})`.mapWith(Number),
      esperado: sql<number>`coalesce(sum(${recepcionLineas.esperado}), 0)`.mapWith(Number),
      recibido: sql<number>`coalesce(sum(${recepcionLineas.recibido}), 0)`.mapWith(Number),
    })
    .from(recepciones)
    .leftJoin(recepcionLineas, eq(recepcionLineas.recepcionId, recepciones.id))
    .where(and(eq(recepciones.empresaId, empresa.id)))
    .groupBy(recepciones.id)
    .orderBy(desc(recepciones.fecha))
    .limit(60);
  const abiertas = filas.filter((f) => f.r.estado !== "cerrada").reverse();
  const cerradas = filas.filter((f) => f.r.estado === "cerrada").slice(0, 8);

  return (
    <>
      <Encabezado titulo="Recepción" />
      {abiertas.length === 0 ? (
        <Vacio titulo="No hay recepciones abiertas">Cuando Fierro avise un ingreso va a aparecer acá. Si llegó algo sin aviso, creá la recepción abajo.</Vacio>
      ) : (
        <div className="overflow-x-auto border-y border-borde">
          <table className="tabla">
            <thead>
              <tr>
                <th>Recepción</th>
                <th>Origen</th>
                <th className="hidden text-right sm:table-cell">Títulos</th>
                <th className="hidden text-right sm:table-cell">Esperadas</th>
                <th className="hidden md:table-cell">Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {abiertas.map(({ r, titulos, esperado, recibido }) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/recepcion/${r.id}`} className="enlace numero">
                      {r.numero}
                    </Link>
                  </td>
                  <td>
                    <span className="font-medium">{r.proveedor}</span>
                    <span className="block text-suave md:hidden">
                      <span className="sm:hidden">
                        {plural(titulos, "título", "títulos")} · {r.fierroId ? `${esperado} unidades esperadas` : "sin aviso de Fierro"} ·{" "}
                      </span>
                      {fechaCorta(r.fecha)}
                    </span>
                  </td>
                  <td className="hidden text-right sm:table-cell">{titulos}</td>
                  <td className="hidden text-right sm:table-cell">{r.fierroId ? <span className="font-semibold">{esperado}</span> : <span className="text-suave">sin aviso de Fierro</span>}</td>
                  <td className="hidden whitespace-nowrap text-suave md:table-cell">{fechaCorta(r.fecha)}</td>
                  <td>{r.estado === "en_curso" ? <Insignia tono="acento">En curso · {recibido} contadas</Insignia> : <Insignia>Sin empezar</Insignia>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-9">
        <h2 className="titulo-seccion">Llegó algo sin aviso</h2>
        <Formulario accion={crear} boton="Crear recepción" clase="flex flex-wrap items-start gap-3">
          <input name="proveedor" className="campo max-w-sm flex-1 basis-64" placeholder="¿De dónde viene? (imprenta, feria, proveedor…)" aria-label="Origen de la mercadería" required />
        </Formulario>
      </section>

      {cerradas.length > 0 && (
        <section className="mt-9">
          <h2 className="titulo-seccion">Últimas cerradas</h2>
          <ul className="lista">
            {cerradas.map(({ r, recibido }) => (
              <li key={r.id}>
                <Link href={`/recepcion/${r.id}`} className="fila justify-between">
                  <span className="min-w-0">
                    <span className="numero">{r.numero}</span> · {r.proveedor}
                  </span>
                  <span className="text-sm whitespace-nowrap text-suave">{recibido} unidades</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
