import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { BotonAccion, Escaneo } from "@/components/Escaneo";
import { Aviso, Codigo, Encabezado, Insignia, type Tono } from "@/components/ui";
import { clientes, devolucionLineas, devoluciones, productos } from "@/db/schema";
import { ESTADOS_LIBRO } from "@/lib/flujos/devoluciones";
import { requerir } from "@/lib/sesion";
import { cerrar, escanear, quitar } from "../acciones";

const TONO: Record<string, Tono> = { vendible: "ok", danado: "peligro", saldo: "alerta" };

export default async function Devolucion({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, empresa } = await requerir();
  const [fila] = await db.select({ d: devoluciones, cliente: clientes.nombre }).from(devoluciones).innerJoin(clientes, eq(clientes.id, devoluciones.clienteId)).where(and(eq(devoluciones.id, id), eq(devoluciones.empresaId, empresa.id)));
  if (!fila) notFound();
  const { d, cliente } = fila;
  const lineas = await db.select({ l: devolucionLineas, titulo: productos.titulo, codigo: productos.codigoBarras }).from(devolucionLineas).innerJoin(productos, eq(productos.id, devolucionLineas.productoId)).where(eq(devolucionLineas.devolucionId, id)).orderBy(asc(productos.titulo));
  const abierta = d.estado === "en_curso";
  const total = (e: string) => lineas.filter((x) => x.l.estadoLibro === e).reduce((s, x) => s + x.l.cantidad, 0);

  return (
    <>
      <Encabezado titulo={`Devolución ${d.numero}`} bajada={cliente} volver={{ href: "/devoluciones", texto: "Devoluciones" }} />
      {!abierta && (
        <div className="mb-6">
          <Aviso tono="ok">
            Devolución cerrada. Los vendibles esperan en Devoluciones para{" "}
            <Link href="/guardar?zona=devoluciones" className="font-semibold underline underline-offset-[3px]">
              guardar
            </Link>
            ; los dañados y los saldos ya están en su zona.
          </Aviso>
        </div>
      )}
      <div className={`grid gap-5 lg:items-start lg:gap-10 ${abierta ? "lg:grid-cols-[minmax(0,22rem)_1fr]" : ""}`}>
        {abierta && (
          <div className="space-y-3 lg:sticky lg:top-30">
            <Escaneo accion={escanear} contexto="devolucion" ocultos={{ id }} campos={[{ nombre: "producto", etiqueta: "Libro", ayuda: "Código, título o autor" }]} cantidad={1} boton="Sumar">
              <fieldset>
                <legend className="etiqueta">¿En qué estado está?</legend>
                <div className="space-y-2">
                  {ESTADOS_LIBRO.map((e, i) => (
                    <label key={e.id} className="flex cursor-pointer items-start gap-3 rounded-control border border-borde-fuerte px-3 py-2.5 transition-colors duration-150 hover:bg-hundido has-checked:border-acento-texto has-checked:bg-acento-suave">
                      <input type="radio" name="estadoLibro" value={e.id} defaultChecked={i === 0} className="mt-1 size-4 accent-(--acento-texto)" />
                      <span>
                        <span className="block font-semibold">{e.nombre}</span>
                        <span className="block text-sm text-suave">{e.ayuda}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Escaneo>
            <BotonAccion accion={cerrar} ocultos={{ id }} clase="boton w-full" motivo={lineas.length === 0 ? "Todavía no escaneaste ningún libro." : undefined} confirmar="¿Cerrar la devolución? Los libros entran al stock y ya no se puede corregir.">
              Cerrar devolución
            </BotonAccion>
          </div>
        )}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            {ESTADOS_LIBRO.map((e) => (
              <Insignia key={e.id} tono={TONO[e.id]}>
                {e.nombre}: {total(e.id)}
              </Insignia>
            ))}
          </div>
          {lineas.length === 0 ? (
            <p className="border-y border-borde px-2 py-8 text-sm text-suave lg:px-3">Todavía no hay libros. Escaneá el primero.</p>
          ) : (
            <ul className="lista">
              {lineas.map(({ l, titulo, codigo }) => (
                <li key={`${l.productoId}-${l.estadoLibro}`} className="fila flex-wrap">
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block font-medium">{titulo}</span>
                    <Codigo>{codigo}</Codigo>
                  </span>
                  <Insignia tono={TONO[l.estadoLibro]}>{ESTADOS_LIBRO.find((e) => e.id === l.estadoLibro)?.nombre}</Insignia>
                  <span className="w-10 text-right font-bold whitespace-nowrap">× {l.cantidad}</span>
                  {abierta && (
                    <BotonAccion accion={quitar} ocultos={{ id, productoId: l.productoId, estadoLibro: l.estadoLibro }} clase="boton-chico border-peligro/50 text-peligro hover:border-peligro hover:bg-peligro-suave hover:text-peligro" mostrarOk={false}>
                      Quitar
                    </BotonAccion>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
