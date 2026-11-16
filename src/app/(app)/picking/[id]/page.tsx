import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { BotonAccion, Escaneo } from "@/components/Escaneo";
import { Avance, Aviso, Codigo, Encabezado, Insignia } from "@/components/ui";
import { clientes, pedidoLineas, pedidos, productos, tareasPicking, ubicaciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { confirmar, faltante, tomar } from "../acciones";

export default async function PickingPedido({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, empresa } = await requerir();
  const [fila] = await db.select({ p: pedidos, cliente: clientes.nombre }).from(pedidos).innerJoin(clientes, eq(clientes.id, pedidos.clienteId)).where(and(eq(pedidos.id, id), eq(pedidos.empresaId, empresa.id)));
  if (!fila) notFound();
  const { p, cliente } = fila;
  const lineas = await db.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, id));
  const tareas = await db
    .select({ t: tareasPicking, titulo: productos.titulo, codigo: productos.codigoBarras, ubicacion: ubicaciones.codigo })
    .from(tareasPicking)
    .innerJoin(productos, eq(productos.id, tareasPicking.productoId))
    .leftJoin(ubicaciones, eq(ubicaciones.id, tareasPicking.ubicacionId))
    .where(eq(tareasPicking.pedidoId, id))
    .orderBy(asc(ubicaciones.codigo), asc(productos.titulo));

  const total = lineas.reduce((s, l) => s + l.cantidad, 0);
  const pickeado = lineas.reduce((s, l) => s + l.pickeado, 0);
  const pendientes = tareas.filter((x) => x.t.estado === "pendiente");
  const faltantes = tareas.filter((x) => x.t.estado === "faltante" && x.t.cantidad - x.t.pickeado > 0);
  const hechas = tareas.filter((x) => x.t.pickeado > 0);
  const proxima = pendientes[0];

  return (
    <>
      <Encabezado titulo={`Pedido ${p.numero}`} bajada={cliente} volver={{ href: "/picking", texto: "Picking" }}>
        {p.modalidad === "consignacion" && <Insignia>Consignación</Insignia>}
      </Encabezado>

      {p.estado === "pendiente" ? (
        <div className="tarjeta max-w-md space-y-3 p-5">
          <p>
            Este pedido tiene <strong>{total} unidades</strong> de {lineas.length} títulos y todavía no lo tomó nadie.
          </p>
          <BotonAccion accion={tomar} ocultos={{ id }} clase="boton w-full" mostrarOk={false}>
            Preparar este pedido
          </BotonAccion>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start">
          <div className="space-y-3 lg:sticky lg:top-6">
            <div className="tarjeta p-4">
              <Avance hecho={pickeado} total={total} unidad="unidades" />
            </div>

            {proxima ? (
              <>
                <div className="rounded-2xl bg-acento p-5 text-sobre-acento">
                  <p className="text-sm font-semibold opacity-80">Próxima parada · quedan {pendientes.length}</p>
                  <p className="mt-1 font-mono text-5xl leading-none font-bold tracking-tight">{proxima.ubicacion}</p>
                  <p className="mt-4 text-lg leading-snug font-semibold">{proxima.titulo}</p>
                  <p className="font-mono text-sm opacity-80">{proxima.codigo}</p>
                  <p className="mt-3 text-base">
                    Tomá <span className="text-3xl font-bold">{proxima.t.cantidad - proxima.t.pickeado}</span>
                  </p>
                </div>
                <Escaneo
                  accion={confirmar}
                  ocultos={{ tareaId: proxima.t.id }}
                  campos={[
                    { nombre: "ubicacion", etiqueta: "Estante", ayuda: "Escaneá el cartel" },
                    { nombre: "producto", etiqueta: "Libro" },
                  ]}
                  cantidad={proxima.t.cantidad - proxima.t.pickeado}
                  boton="Confirmar"
                />
                <BotonAccion accion={faltante} ocultos={{ tareaId: proxima.t.id }} clase="boton-suave w-full" confirmar={`¿Seguro que en ${proxima.ubicacion} no ${proxima.t.cantidad - proxima.t.pickeado === 1 ? "está la unidad que falta" : `están las ${proxima.t.cantidad - proxima.t.pickeado} unidades que faltan`}? miDepo va a buscar el título en otro estante.`}>
                  No está en el estante
                </BotonAccion>
              </>
            ) : p.estado === "preparado" ? (
              <Aviso tono="ok">
                <p className="mb-3 text-base">Picking terminado. {faltantes.length > 0 ? "Sale con faltantes." : "Está completo."}</p>
                <Link href={`/empaque/${id}`} className="boton w-full">
                  Ir a empacar
                </Link>
              </Aviso>
            ) : (
              <Aviso tono="ok">Este pedido ya pasó por empaque.</Aviso>
            )}
          </div>

          <div className="space-y-5">
            {faltantes.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-peligro">Faltantes</h2>
                <ul className="tarjeta divide-y divide-borde/70">
                  {faltantes.map(({ t, titulo, ubicacion }) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span>
                        <span className="block font-medium">{titulo}</span>
                        <span className="text-suave">{ubicacion ? `No estaba en ${ubicacion}` : "Sin stock en estanterías"}</span>
                      </span>
                      <Insignia tono="peligro">Faltan {t.cantidad - t.pickeado}</Insignia>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {pendientes.length > 1 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-suave">Después</h2>
                <ul className="tarjeta divide-y divide-borde/70">
                  {pendientes.slice(1).map(({ t, titulo, ubicacion }) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <Codigo>{ubicacion}</Codigo>
                      <span className="min-w-0 flex-1 truncate">{titulo}</span>
                      <span className="font-semibold">× {t.cantidad - t.pickeado}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {hechas.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-suave">Ya tomado</h2>
                <ul className="tarjeta divide-y divide-borde/70">
                  {hechas.map(({ t, titulo, ubicacion }) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm text-suave">
                      <Codigo>{ubicacion}</Codigo>
                      <span className="min-w-0 flex-1 truncate">{titulo}</span>
                      <span className="font-semibold text-ok">✓ {t.pickeado}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
