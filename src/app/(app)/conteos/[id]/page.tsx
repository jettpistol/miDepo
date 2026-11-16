import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { BotonAccion } from "@/components/Escaneo";
import { Avance, Aviso, Codigo, Encabezado, Insignia } from "@/components/ui";
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
      <div className="tarjeta mb-5 p-4">
        <Avance hecho={contadas} total={us.length} unidad="ubicaciones" />
      </div>

      {esSupervisor && abierto && contadas > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="font-semibold">Revisión del supervisor</h2>
          {difs.length === 0 ? (
            <Aviso tono="ok">Lo contado hasta ahora coincide con el sistema.</Aviso>
          ) : (
            <div className="tarjeta overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th>Título</th>
                    <th className="text-right">Sistema</th>
                    <th className="text-right">Contado</th>
                    <th className="text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {difs.map((d) => (
                    <tr key={`${d.ubicacionId}-${d.productoId}`}>
                      <td>
                        <Codigo>{d.ubicacion}</Codigo>
                      </td>
                      <td className="font-medium">{d.titulo}</td>
                      <td className="text-right">{d.sistema}</td>
                      <td className="text-right font-semibold">{d.contado}</td>
                      <td className={`text-right font-semibold ${d.contado < d.sistema ? "text-peligro" : "text-ok"}`}>{d.contado > d.sistema ? "+" : ""}{d.contado - d.sistema}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <BotonAccion accion={aprobar} ocultos={{ id }} confirmar={`Se va a ajustar el stock de ${contadas} ubicaciones contadas${difs.length ? ` (${difs.length} diferencias)` : ""}.${contadas < us.length ? ` Las ${us.length - contadas} sin contar quedan como están.` : ""} ¿Cerrar el conteo?`}>
            Aprobar y ajustar stock
          </BotonAccion>
        </section>
      )}

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {us.map(({ u, codigo, quien }) => (
          <li key={u.ubicacionId} className="tarjeta flex items-center justify-between gap-2 p-3">
            {abierto && u.estado === "pendiente" ? (
              <Link href={`/conteos/${id}/${u.ubicacionId}`} className="flex flex-1 items-center justify-between gap-2">
                <span className="font-mono text-lg font-bold">{codigo}</span>
                <span className="boton-suave min-h-9 px-3 py-1.5 text-sm">Contar</span>
              </Link>
            ) : (
              <>
                <span>
                  <span className="block font-mono text-lg font-bold">{codigo}</span>
                  {quien && <span className="block text-xs text-suave">Contó {quien}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Insignia tono="ok">Contada</Insignia>
                  {abierto && esSupervisor && (
                    <BotonAccion accion={reabrir} ocultos={{ id, ubicacionId: u.ubicacionId }} clase="cursor-pointer text-xs font-semibold text-suave underline" mostrarOk={false}>
                      Reabrir
                    </BotonAccion>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
