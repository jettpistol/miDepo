import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { BotonAccion, Escaneo } from "@/components/Escaneo";
import { Avance, Aviso, Codigo, Encabezado, Insignia } from "@/components/ui";
import { productos, recepcionLineas, recepciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { cerrar, corregir, escanear } from "../acciones";
import { Corregir } from "./Corregir";

export default async function Recepcion({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, empresa } = await requerir("operario", "recepcion");
  const [r] = await db.select().from(recepciones).where(and(eq(recepciones.id, id), eq(recepciones.empresaId, empresa.id)));
  if (!r) notFound();
  const lineas = await db
    .select({ l: recepcionLineas, titulo: productos.titulo, codigo: productos.codigoBarras })
    .from(recepcionLineas)
    .innerJoin(productos, eq(productos.id, recepcionLineas.productoId))
    .where(eq(recepcionLineas.recepcionId, id))
    .orderBy(asc(productos.titulo));
  const esperado = lineas.reduce((s, x) => s + x.l.esperado, 0);
  const recibido = lineas.reduce((s, x) => s + x.l.recibido, 0);
  const conDiferencia = lineas.filter((x) => x.l.recibido !== x.l.esperado).length;
  const abierta = r.estado !== "cerrada";

  return (
    <>
      <Encabezado titulo={`${r.numero} · ${r.proveedor}`} volver={{ href: "/recepcion", texto: "Recepciones" }} bajada={r.origen === "fierro" ? "Ingreso avisado por Fierro" : "Recepción sin aviso"} />

      {abierta ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
          <div className="space-y-3 lg:sticky lg:top-6">
            <Escaneo accion={escanear} ocultos={{ id }} campos={[{ nombre: "producto", etiqueta: "Libro" }]} cantidad={1} boton="Sumar" />
            {esperado > 0 && (
              <div className="tarjeta p-4">
                <Avance hecho={recibido} total={esperado} unidad="unidades" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <BotonAccion accion={cerrar} ocultos={{ id }} clase="boton w-full" confirmar={conDiferencia > 0 ? `Hay ${conDiferencia} títulos con una cantidad distinta a la esperada. ¿Cerrar la recepción igual?` : "¿Cerrar la recepción? Después no se puede seguir escaneando."}>
                Cerrar recepción
              </BotonAccion>
            </div>
          </div>
          <Lineas lineas={lineas} id={id} editable />
        </div>
      ) : (
        <div className="space-y-4">
          <Aviso tono="ok">
            Recepción cerrada con {recibido} unidades. {r.enviadoAFierro ? "Ya está cargada en Fierro." : "Falta cargarla en Fierro."}{" "}
            <Link href="/guardar" className="underline">
              Ir a guardar
            </Link>
          </Aviso>
          <Lineas lineas={lineas} id={id} />
        </div>
      )}
    </>
  );
}

function Lineas({ lineas, id, editable = false }: { lineas: { l: typeof recepcionLineas.$inferSelect; titulo: string; codigo: string }[]; id: number; editable?: boolean }) {
  if (lineas.length === 0) return <p className="tarjeta p-6 text-center text-sm text-suave">Todavía no hay títulos. Escaneá el primero.</p>;
  return (
    <div className="tarjeta overflow-x-auto">
      <table className="tabla">
        <thead>
          <tr>
            <th>Título</th>
            <th className="text-right">Esperado</th>
            <th className="text-right">Recibido</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lineas.map(({ l, titulo, codigo }) => (
            <tr key={l.id}>
              <td>
                <span className="block font-medium">{titulo}</span>
                <Codigo>{codigo}</Codigo>
              </td>
              <td className="text-right">{l.esperado || "—"}</td>
              <td className="text-right font-semibold">{editable ? <Corregir accion={corregir} ocultos={{ id, productoId: l.productoId }} campo="recibido" valor={l.recibido} /> : l.recibido}</td>
              <td className="text-right">
                {l.esperado === 0 ? <Insignia tono="alerta">No avisado</Insignia> : l.recibido === l.esperado ? <Insignia tono="ok">Completo</Insignia> : l.recibido > l.esperado ? <Insignia tono="alerta">+{l.recibido - l.esperado}</Insignia> : l.recibido > 0 ? <Insignia tono="acento">Faltan {l.esperado - l.recibido}</Insignia> : <Insignia>Pendiente</Insignia>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
