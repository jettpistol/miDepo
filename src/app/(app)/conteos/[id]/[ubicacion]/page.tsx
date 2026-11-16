import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { BotonAccion, Escaneo } from "@/components/Escaneo";
import { Codigo, Encabezado, Tejuelo } from "@/components/ui";
import { conteoLineas, conteoUbicaciones, conteos, productos, ubicaciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { Corregir } from "../../../recepcion/[id]/Corregir";
import { corregir, escanear, terminar } from "../../acciones";

export default async function ContarUbicacion({ params }: { params: Promise<{ id: string; ubicacion: string }> }) {
  const { id: idTexto, ubicacion } = await params;
  const id = Number(idTexto);
  const ubicacionId = Number(ubicacion);
  const { db, empresa } = await requerir();
  const [fila] = await db
    .select({ k: conteos, u: conteoUbicaciones, codigo: ubicaciones.codigo })
    .from(conteoUbicaciones)
    .innerJoin(conteos, eq(conteos.id, conteoUbicaciones.conteoId))
    .innerJoin(ubicaciones, eq(ubicaciones.id, conteoUbicaciones.ubicacionId))
    .where(and(eq(conteoUbicaciones.conteoId, id), eq(conteoUbicaciones.ubicacionId, ubicacionId), eq(conteos.empresaId, empresa.id)));
  if (!fila) notFound();
  const lineas = await db.select({ l: conteoLineas, titulo: productos.titulo, codigo: productos.codigoBarras }).from(conteoLineas).innerJoin(productos, eq(productos.id, conteoLineas.productoId)).where(and(eq(conteoLineas.conteoId, id), eq(conteoLineas.ubicacionId, ubicacionId))).orderBy(asc(productos.titulo));
  const abierta = fila.k.estado === "abierto" && fila.u.estado === "pendiente";

  return (
    <>
      <Encabezado
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            Contar <Tejuelo codigo={fila.codigo} tam="md" className="text-[26px]" />
          </span>
        } volver={{ href: `/conteos/${id}`, texto: fila.k.nombre }} bajada="Escaneá todo lo que haya en este lugar. Si un título está muchas veces, escribí la cantidad." />
      <div className={abierta ? "grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-10" : "max-w-3xl"}>
        {abierta && (
          <div className="space-y-3 lg:sticky lg:top-30">
            <Escaneo accion={escanear} ocultos={{ id, ubicacionId }} campos={[{ nombre: "producto", etiqueta: "Libro" }]} cantidad={1} boton="Sumar" />
            <BotonAccion accion={terminar} ocultos={{ id, ubicacionId }} clase="boton-suave w-full" confirmar={lineas.length === 0 ? `¿Confirmás que ${fila.codigo} está vacía?` : `¿Ya contaste todo lo que hay en ${fila.codigo}?`} mostrarOk={false}>
              {lineas.length === 0 ? "Está vacía" : "Terminé esta ubicación"}
            </BotonAccion>
          </div>
        )}
        {lineas.length === 0 ? (
          <p className="border-y border-borde px-2 py-8 text-sm text-suave lg:px-3">Todavía no contaste nada acá.</p>
        ) : (
          <ul className="lista">
            {lineas.map(({ l, titulo, codigo }) => (
              <li key={l.productoId} className="fila justify-between">
                <span className="min-w-0">
                  <span className="block font-medium">{titulo}</span>
                  <Codigo>{codigo}</Codigo>
                </span>
                {abierta ? <Corregir accion={corregir} ocultos={{ id, ubicacionId, productoId: l.productoId }} campo="contado" valor={l.contado} /> : <span className="text-base font-semibold tabular-nums">{l.contado}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
