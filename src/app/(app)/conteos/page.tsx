import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Formulario } from "@/components/Escaneo";
import { Avance, Encabezado, fechaCorta, Insignia, Vacio } from "@/components/ui";
import { conteoUbicaciones, conteos } from "@/db/schema";
import { puede, requerir } from "@/lib/sesion";
import { crear } from "./acciones";

export const metadata = { title: "Conteos" };

export default async function Conteos() {
  const { db, empresa, usuario } = await requerir();
  const filas = await db
    .select({
      k: conteos,
      total: sql<number>`count(${conteoUbicaciones.ubicacionId})`.mapWith(Number),
      contadas: sql<number>`count(*) filter (where ${conteoUbicaciones.estado} = 'contada')`.mapWith(Number),
    })
    .from(conteos)
    .leftJoin(conteoUbicaciones, eq(conteoUbicaciones.conteoId, conteos.id))
    .where(eq(conteos.empresaId, empresa.id))
    .groupBy(conteos.id)
    .orderBy(desc(conteos.fecha))
    .limit(40);

  return (
    <>
      <Encabezado titulo="Conteos" bajada="Contar un tramo por vez, sin cerrar el depósito. Se cuenta a ciegas: el sistema no dice cuánto debería haber." />
      {puede(usuario.rol, "supervisor") && (
        <section className="tarjeta mb-9 max-w-3xl p-4">
          <h2 className="titulo-seccion">Nuevo conteo</h2>
          <Formulario accion={crear} boton="Crear conteo" clase="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="nombre" className="etiqueta">
                Nombre
              </label>
              <input id="nombre" name="nombre" className="campo" placeholder="Pasillo A, noviembre" required />
            </div>
            <div>
              <label htmlFor="prefijo" className="etiqueta">
                Ubicaciones que empiezan con
              </label>
              <input id="prefijo" name="prefijo" className="campo font-mono" placeholder="A-01" autoCapitalize="characters" required />
            </div>
          </Formulario>
        </section>
      )}
      {filas.length === 0 ? (
        <Vacio icono="conteo" titulo="No hay conteos">
          {puede(usuario.rol, "supervisor") ? "Creá el primero arriba." : "Cuando tu supervisor arme un conteo, va a aparecer acá."}
        </Vacio>
      ) : (
        <div className="overflow-x-auto border-y border-borde">
          <table className="tabla">
            <thead>
              <tr>
                <th>Conteo</th>
                <th className="hidden w-[30%] min-w-40 sm:table-cell">Ubicaciones contadas</th>
                <th className="hidden md:table-cell">Creado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ k, total, contadas }) => (
                <tr key={k.id}>
                  <td>
                    <Link href={`/conteos/${k.id}`} className="enlace">
                      {k.nombre}
                    </Link>
                    <span className="block text-suave md:hidden">
                      <span className="sm:hidden">
                        {contadas} de {total} ubicaciones ·{" "}
                      </span>
                      {fechaCorta(k.fecha)}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <Avance hecho={contadas} total={total} />
                  </td>
                  <td className="hidden whitespace-nowrap text-suave md:table-cell">{fechaCorta(k.fecha)}</td>
                  <td className="w-px">{k.estado === "cerrado" ? <Insignia tono="ok">Cerrado</Insignia> : contadas === total ? <Insignia tono="alerta">Para revisar</Insignia> : <Insignia tono="acento">Abierto</Insignia>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
