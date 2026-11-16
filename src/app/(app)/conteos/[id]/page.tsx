import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { BotonAccion } from "@/components/Escaneo";
import { Avance, Aviso, Encabezado, Insignia, Tejuelo } from "@/components/ui";
import { conteoUbicaciones, conteos, ubicaciones, usuarios } from "@/db/schema";
import { diferencias } from "@/lib/flujos/conteos";
import { puede, requerir } from "@/lib/sesion";
import { aprobar, reabrir } from "../acciones";

export default async function Conteo({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, empresa, usuario } = await requerir();
  const [k] = await db.select().from(conteos).where(and(eq(conteos.id, id), eq(conteos.empresaId, empresa.id)));
  if (!k) notFound();
  const us = await db
    .select({ u: conteoUbicaciones, codigo: ubicaciones.codigo, quien: usuarios.nombre })
    .from(conteoUbicaciones)
    .innerJoin(ubicaciones, eq(ubicaciones.id, conteoUbicaciones.ubicacionId))
    .leftJoin(usuarios, eq(usuarios.id, conteoUbicaciones.contadoPor))
    .where(eq(conteoUbicaciones.conteoId, id))
    .orderBy(asc(ubicaciones.codigo));
  const contadas = us.filter((x) => x.u.estado === "contada").length;
  const esSupervisor = puede(usuario.rol, "supervisor");
  const abierto = k.estado === "abierto";
  const difs = esSupervisor && abierto ? (await diferencias(db, id)).filter((d) => d.sistema !== d.contado) : [];

  return (
    <>
      <Encabezado titulo={k.nombre} volver={{ href: "/conteos", texto: "Conteos" }} bajada={abierto ? "Elegí una ubicación, contá todo lo que hay y dala por terminada." : "Conteo cerrado: el stock ya quedó ajustado."} />
      <div className="mb-9 max-w-xl">
        <Avance hecho={contadas} total={us.length} unidad="ubicaciones" />
      </div>

      {esSupervisor && abierto && contadas > 0 && (
        <section className="mb-9">
          <h2 className="titulo-seccion">
            Revisión del supervisor {difs.length > 0 && <small>{difs.length}</small>}
          </h2>
          {difs.length === 0 ? (
            <Aviso tono="ok">Lo contado hasta ahora coincide con el sistema.</Aviso>
          ) : (
            <div className="overflow-x-auto border-y border-borde">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th>Título</th>
                    <th className="hidden text-right sm:table-cell">Sistema</th>
                    <th className="hidden text-right sm:table-cell">Contado</th>
                    <th className="text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {difs.map((d) => (
                    <tr key={`${d.ubicacionId}-${d.productoId}`}>
                      <td className="w-px">
                        <Tejuelo codigo={d.ubicacion} />
                      </td>
                      <td>
                        <span className="font-medium">{d.titulo}</span>
                        <span className="block text-suave sm:hidden">
                          Sistema {d.sistema} · Contado {d.contado}
                        </span>
                      </td>
                      <td className="hidden text-right sm:table-cell">{d.sistema}</td>
                      <td className="hidden text-right font-semibold sm:table-cell">{d.contado}</td>
                      <td className={`text-right font-semibold ${d.contado < d.sistema ? "text-peligro" : "text-ok"}`}>{d.contado > d.sistema ? "+" : ""}{d.contado - d.sistema}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <BotonAccion accion={aprobar} ocultos={{ id }} confirmar={`Se va a ajustar el stock de ${contadas} ubicaciones contadas${difs.length ? ` (${difs.length} diferencias)` : ""}.${contadas < us.length ? ` Las ${us.length - contadas} sin contar quedan como están.` : ""} ¿Cerrar el conteo?`}>
              Aprobar y ajustar stock
            </BotonAccion>
          </div>
        </section>
      )}

      <section>
        <h2 className="titulo-seccion">
          Ubicaciones <small>{us.length}</small>
        </h2>
        <div className="max-w-3xl overflow-x-auto border-y border-borde">
          <table className="tabla">
            <thead>
              <tr>
                <th>Ubicación</th>
                <th>Estado</th>
                <th className="hidden sm:table-cell">Quién contó</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {us.map(({ u, codigo, quien }) =>
                abierto && u.estado === "pendiente" ? (
                  <tr key={u.ubicacionId}>
                    <td>
                      <Link href={`/conteos/${id}/${u.ubicacionId}`}>
                        <Tejuelo codigo={codigo} tam="md" />
                      </Link>
                    </td>
                    <td />
                    <td className="hidden sm:table-cell" />
                    <td className="w-px text-right">
                      <Link href={`/conteos/${id}/${u.ubicacionId}`} className="boton-chico">
                        Contar
                      </Link>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.ubicacionId}>
                    <td>
                      <Tejuelo codigo={codigo} tam="md" />
                    </td>
                    <td>
                      <Insignia tono="ok">Contada</Insignia>
                      {quien && <span className="mt-1 block text-xs text-suave sm:hidden">Contó {quien}</span>}
                    </td>
                    <td className="hidden text-suave sm:table-cell">{quien ?? "—"}</td>
                    <td className="w-px text-right">
                      {abierto && esSupervisor && (
                        <BotonAccion accion={reabrir} ocultos={{ id, ubicacionId: u.ubicacionId }} clase="boton-chico" mostrarOk={false}>
                          Reabrir
                        </BotonAccion>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
