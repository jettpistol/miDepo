import Link from "next/link";
import { and, asc, count, eq, like, sql } from "drizzle-orm";
import { Formulario } from "@/components/Escaneo";
import { Icono } from "@/components/Icono";
import { Encabezado, Insignia, Tejuelo } from "@/components/ui";
import { stock, ubicaciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import type { Esquema } from "@/lib/ubicaciones";
import { crearSuelta, generar } from "./acciones";
import { Generador } from "./Generador";

export const metadata = { title: "Ubicaciones" };

export default async function Ubicaciones({ searchParams }: { searchParams: Promise<{ prefijo?: string }> }) {
  const { db, empresa } = await requerir("supervisor");
  const prefijo = ((await searchParams).prefijo ?? "").trim().toUpperCase().replace(/[%_]/g, "");
  const [{ total }] = await db.select({ total: count() }).from(ubicaciones).where(and(eq(ubicaciones.empresaId, empresa.id), eq(ubicaciones.tipo, "estanteria")));
  const lista = await db
    .select({ u: ubicaciones, titulos: sql<number>`count(${stock.productoId})`.mapWith(Number), unidades: sql<number>`coalesce(sum(${stock.cantidad}), 0)`.mapWith(Number) })
    .from(ubicaciones)
    .leftJoin(stock, eq(stock.ubicacionId, ubicaciones.id))
    .where(and(eq(ubicaciones.empresaId, empresa.id), eq(ubicaciones.tipo, "estanteria"), like(ubicaciones.codigo, `${prefijo}%`)))
    .groupBy(ubicaciones.id)
    .orderBy(asc(ubicaciones.codigo))
    .limit(120);

  return (
    <>
      <Encabezado titulo="Ubicaciones" bajada={`${total.toLocaleString("es-AR")} estantes cargados. Cada uno lleva una etiqueta con su código de barras.`}>
        <Link href={`/imprimir/ubicaciones?prefijo=${encodeURIComponent(prefijo)}`} target="_blank" className="boton-suave">
          <Icono nombre="imprimir" /> Imprimir etiquetas{prefijo && ` de ${prefijo}…`}
        </Link>
        <Link href="/imprimir/productos" target="_blank" className="boton-suave">
          Etiquetas sin ISBN
        </Link>
      </Encabezado>

      <form className="mb-4 flex max-w-md gap-2">
        <input name="prefijo" defaultValue={prefijo} className="campo font-mono" placeholder="Ver las que empiezan con… (A-01)" aria-label="Filtrar por comienzo del código" autoCapitalize="characters" />
        <button className="boton-suave">Filtrar</button>
      </form>
      {lista.length > 0 ? (
        <div className="max-w-3xl overflow-x-auto border-y border-borde">
          <table className="tabla">
            <thead>
              <tr>
                <th>Ubicación</th>
                <th className="text-right">Títulos</th>
                <th className="text-right">Unidades</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ u, titulos, unidades }) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/ubicaciones/${u.id}`}>
                      <Tejuelo codigo={u.codigo} tam="md" />
                    </Link>
                  </td>
                  <td className={`text-right ${titulos === 0 ? "text-suave" : ""}`}>{titulos}</td>
                  <td className={`text-right ${unidades === 0 ? "text-suave" : "font-semibold"}`}>{unidades}</td>
                  <td>{!u.activa ? <Insignia tono="alerta">Dada de baja</Insignia> : titulos === 0 ? <span className="text-suave">Vacía</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="max-w-3xl border-y border-borde px-2 py-6 text-sm text-suave lg:px-3">{total === 0 ? "Todavía no hay estantes. Crealos con el generador de abajo." : `Ninguna ubicación empieza con "${prefijo}".`}</p>
      )}
      {lista.length === 120 && <p className="mt-3 text-sm text-suave">Se muestran las primeras 120. Usá el filtro para ver otro tramo.</p>}

      <section className="mt-12 max-w-5xl">
        <h2 className="titulo-seccion">Generador de ubicaciones</h2>
        <p className="mb-5 max-w-[70ch] text-sm text-suave">
          Si los estantes todavía no tienen nombre, elegí un modelo y adaptalo. Se puede volver a usar más adelante para sumar un pasillo o un nivel. {empresa.esquemaUbicaciones ? <Insignia tono="acento">Mostrando el esquema que usa {empresa.nombre}</Insignia> : null}
        </p>
        <Generador accion={generar} inicial={(empresa.esquemaUbicaciones as Esquema | null) ?? null} />
      </section>

      <section className="mt-12">
        <h2 className="titulo-seccion">Agregar una ubicación suelta</h2>
        <p className="mb-3 text-sm text-suave">Para lugares que no siguen el esquema: una mesa, un pallet, una vitrina.</p>
        <Formulario accion={crearSuelta} boton="Agregar" clase="flex flex-wrap items-start gap-3">
          <input name="codigo" className="campo max-w-56 font-mono" placeholder="MESA-1" aria-label="Código de la ubicación" autoCapitalize="characters" required />
        </Formulario>
      </section>
    </>
  );
}
