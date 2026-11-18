import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { BotonAccion, Escaneo, Formulario } from "@/components/Escaneo";
import { Icono } from "@/components/Icono";
import { Avance, Aviso, Encabezado, Insignia } from "@/components/ui";
import { cajaItems, cajas, clientes, pedidoLineas, pedidos, productos } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { cerrar, escanear, finalizar, vaciar } from "../acciones";

const kg = (g: number) => (g / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 });

export default async function EmpaquePedido({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, empresa } = await requerir("operario", "empaque");
  const [fila] = await db.select({ p: pedidos, cliente: clientes.nombre }).from(pedidos).innerJoin(clientes, eq(clientes.id, pedidos.clienteId)).where(and(eq(pedidos.id, id), eq(pedidos.empresaId, empresa.id)));
  if (!fila) notFound();
  const { p, cliente } = fila;
  const lineas = await db.select({ l: pedidoLineas, titulo: productos.titulo }).from(pedidoLineas).innerJoin(productos, eq(productos.id, pedidoLineas.productoId)).where(eq(pedidoLineas.pedidoId, id)).orderBy(asc(productos.titulo));
  const delPedido = await db.select().from(cajas).where(eq(cajas.pedidoId, id)).orderBy(asc(cajas.numero));
  const items = delPedido.length
    ? await db.select({ i: cajaItems, titulo: productos.titulo, peso: productos.pesoGramos }).from(cajaItems).innerJoin(productos, eq(productos.id, cajaItems.productoId)).where(inArray(cajaItems.cajaId, delPedido.map((k) => k.id))).orderBy(asc(productos.titulo))
    : [];
  const pickeado = lineas.reduce((s, x) => s + x.l.pickeado, 0);
  const empacado = lineas.reduce((s, x) => s + x.l.empacado, 0);
  const abierta = delPedido.find((k) => k.estado === "abierta");
  const listo = p.estado === "empacado" || p.estado === "despachado";
  const editable = p.estado === "preparado";

  return (
    <>
      <Encabezado titulo={`Empaque ${p.numero}`} bajada={cliente} volver={{ href: "/empaque", texto: "Empaque" }}>
        {delPedido.some((k) => k.estado === "cerrada") && (
          <>
            <Link href={`/imprimir/cajas/${id}`} target="_blank" className="boton-suave">
              <Icono nombre="imprimir" /> Etiquetas
            </Link>
            <Link href={`/imprimir/lista/${id}`} target="_blank" className="boton-suave">
              <Icono nombre="imprimir" /> Lista de empaque
            </Link>
          </>
        )}
      </Encabezado>

      {!editable && !listo && (
        <Aviso tono="alerta">
          Este pedido todavía está en picking.{" "}
          <Link href={`/picking/${id}`} className="underline">
            Ver el recorrido
          </Link>
        </Aviso>
      )}
      {listo && <Aviso tono="ok">Pedido empacado en {delPedido.length} {delPedido.length === 1 ? "caja" : "cajas"}. {p.estado === "despachado" ? "Ya está documentado en Fierro y salió del depósito." : "Imprimí las etiquetas y la lista de empaque; la oficina lo documenta en Fierro."}</Aviso>}

      <div className={`grid gap-5 lg:items-start ${editable ? "lg:grid-cols-[minmax(0,22rem)_1fr]" : ""} ${listo || !editable ? "mt-4" : ""}`}>
        {editable && (
          <div className="space-y-3 lg:sticky lg:top-6">
            <div className="tarjeta p-4">
              <Avance hecho={empacado} total={pickeado} unidad="en cajas" />
            </div>
            {empacado < pickeado && <Escaneo accion={escanear} ocultos={{ id }} campos={[{ nombre: "producto", etiqueta: abierta ? `Libro para la caja ${abierta.numero}` : "Libro (abre una caja nueva)" }]} cantidad={1} boton="Poner en la caja" />}
            {abierta && (
              <div className="tarjeta p-4">
                <h2 className="mb-2 font-semibold">Cerrar la caja {abierta.numero}</h2>
                <Formulario accion={cerrar} boton="Cerrar caja" clase="space-y-3">
                  <input type="hidden" name="cajaId" value={abierta.id} />
                  <div>
                    <label htmlFor="kg" className="etiqueta">
                      Peso real en kg <span className="font-normal text-suave">(opcional)</span>
                    </label>
                    <input id="kg" name="kg" inputMode="decimal" className="campo" placeholder={`Estimado: ${kg(items.filter((x) => x.i.cajaId === abierta.id).reduce((s, x) => s + x.i.cantidad * x.peso, 0))} kg`} />
                  </div>
                </Formulario>
              </div>
            )}
            {empacado === pickeado && !abierta && (
              <BotonAccion accion={finalizar} ocultos={{ id }} clase="boton w-full">
                Terminar pedido
              </BotonAccion>
            )}
          </div>
        )}

        <div className="space-y-5">
          {delPedido.map((k) => {
            const suyos = items.filter((x) => x.i.cajaId === k.id);
            return (
              <section key={k.id} className="tarjeta">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-borde/70 px-4 py-3">
                  <h2 className="font-semibold">Caja {k.numero}</h2>
                  <span className="flex items-center gap-2">
                    {k.estado === "cerrada" ? <Insignia tono="ok">Cerrada · {kg(k.pesoGramos ?? 0)} kg</Insignia> : <Insignia tono="acento">Abierta</Insignia>}
                    {k.estado === "abierta" && editable && (
                      <BotonAccion accion={vaciar} ocultos={{ cajaId: k.id }} clase="text-sm font-semibold text-peligro cursor-pointer" confirmar={`¿Vaciar la caja ${k.numero}? Vas a tener que escanear de nuevo lo que tenía.`} mostrarOk={false}>
                        Vaciar
                      </BotonAccion>
                    )}
                  </span>
                </header>
                <ul className="divide-y divide-borde/70 text-sm">
                  {suyos.map((x) => (
                    <li key={x.i.productoId} className="flex justify-between gap-3 px-4 py-2.5">
                      <span>{x.titulo}</span>
                      <span className="font-semibold">× {x.i.cantidad}</span>
                    </li>
                  ))}
                  {suyos.length === 0 && <li className="px-4 py-3 text-suave">Vacía</li>}
                </ul>
              </section>
            );
          })}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-suave">Títulos del pedido</h2>
            <div className="tarjeta overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th className="text-right">Pedido</th>
                    <th className="text-right">Preparado</th>
                    <th className="text-right">En cajas</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map(({ l, titulo }) => (
                    <tr key={l.id}>
                      <td className="font-medium">{titulo}</td>
                      <td className="text-right">{l.cantidad}</td>
                      <td className={`text-right ${l.pickeado < l.cantidad ? "font-semibold text-peligro" : ""}`}>{l.pickeado}</td>
                      <td className={`text-right font-semibold ${l.empacado === l.pickeado && l.pickeado > 0 ? "text-ok" : ""}`}>{l.empacado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
