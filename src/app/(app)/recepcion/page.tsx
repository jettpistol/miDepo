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
      <Encabezado titulo="Recepción" bajada="Contá lo que llega. Lo que cierres queda esperando en la zona de Recepción para guardar." />
      {abiertas.length === 0 ? (
        <Vacio titulo="No hay recepciones abiertas">Cuando Fierro avise un ingreso va a aparecer acá. Si llegó algo sin aviso, creá la recepción abajo.</Vacio>
      ) : (
        <ul className="space-y-2">
          {abiertas.map(({ r, titulos, esperado, recibido }) => (
            <li key={r.id}>
              <Link href={`/recepcion/${r.id}`} className="tarjeta flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4 hover:border-acento-texto/50">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {r.numero} · {r.proveedor}
                  </span>
                  <span className="block text-sm text-suave">
                    {plural(titulos, "título", "títulos")} · {r.fierroId ? `${esperado} unidades esperadas` : "sin aviso de Fierro"} · {fechaCorta(r.fecha)}
                  </span>
                </span>
                {r.estado === "en_curso" ? <Insignia tono="acento">En curso · {recibido} contadas</Insignia> : <Insignia>Sin empezar</Insignia>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="tarjeta mt-6 p-4">
        <h2 className="font-semibold">Llegó algo sin aviso</h2>
        <p className="mb-3 text-sm text-suave">Creá una recepción vacía y escaneá lo que haya en las cajas.</p>
        <Formulario accion={crear} boton="Crear recepción" clase="flex flex-wrap items-start gap-3">
          <input name="proveedor" className="campo max-w-sm flex-1" placeholder="¿De dónde viene? (imprenta, feria, proveedor…)" aria-label="Origen de la mercadería" required />
        </Formulario>
      </section>

      {cerradas.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-suave">Últimas cerradas</h2>
          <ul className="tarjeta divide-y divide-borde/70 text-sm">
            {cerradas.map(({ r, recibido }) => (
              <li key={r.id}>
                <Link href={`/recepcion/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-hundido">
                  <span>
                    {r.numero} · {r.proveedor}
                  </span>
                  <span className="text-suave">{recibido} unidades</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
