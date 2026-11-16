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
  const { db, empresa } = await requerir();
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
      <Encabezado titulo={`${r.numero} · ${r.proveedor}`} volver={{ href: "/recepcion", texto: "Recepciones" }} bajada={r.fierroId ? "Ingreso avisado por Fierro" : "Recepción sin aviso"} />

      {abierta ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-10">
          <div className="space-y-3 lg:sticky lg:top-30">
            <Escaneo accion={escanear} contexto="recepcion" ocultos={{ id }} campos={[{ nombre: "producto", etiqueta: "Libro", ayuda: "Código, título o autor" }]} cantidad={1} boton="Sumar" />
            {esperado > 0 && <Avance hecho={recibido} total={esperado} unidad="unidades" />}
            <div className="flex flex-wrap gap-2">
              <BotonAccion accion={cerrar} ocultos={{ id }} clase="boton w-full" motivo={recibido === 0 ? "Todavía no escaneaste nada." : undefined} confirmar={conDiferencia > 0 ? `Hay ${conDiferencia} títulos con una cantidad distinta a la esperada. ¿Cerrar la recepción igual?` : "¿Cerrar la recepción? Después no se puede seguir escaneando."}>
                Cerrar recepción
              </BotonAccion>
            </div>
          </div>
          <Lineas lineas={lineas} id={id} editable />
        </div>
      ) : (
        <div className="space-y-6">
          <Aviso tono="ok">
            Recepción cerrada con {recibido} unidades. {r.enviadoAFierro ? "Ya está cargada en Fierro." : "Falta cargarla en Fierro."}{" "}
            <Link href="/guardar" className="font-semibold underline underline-offset-[3px]">
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
  if (lineas.length === 0) return <p className="border-y border-borde px-2 py-8 text-sm text-suave lg:px-3">Todavía no hay títulos. Escaneá el primero.</p>;
  return (
    <div className="min-w-0 overflow-x-auto border-y border-borde">
      <table className="tabla">
        <thead>
          <tr>
            <th>Título</th>
            <th className="hidden text-right sm:table-cell">Esperado</th>
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
                {l.esperado > 0 && <span className="mt-0.5 block text-suave sm:hidden">Esperado: {l.esperado}</span>}
              </td>
              <td className="hidden text-right sm:table-cell">{l.esperado || "—"}</td>
              <td className="text-right font-bold">{editable ? <Corregir accion={corregir} ocultos={{ id, productoId: l.productoId }} campo="recibido" valor={l.recibido} /> : l.recibido}</td>
              <td className="w-px text-right">
                {l.esperado === 0 ? <Insignia tono="alerta">No avisado</Insignia> : l.recibido === l.esperado ? <Insignia tono="ok">Completo</Insignia> : l.recibido > l.esperado ? <Insignia tono="alerta">+{l.recibido - l.esperado}</Insignia> : l.recibido > 0 ? <Insignia tono="acento">Faltan {l.esperado - l.recibido}</Insignia> : <Insignia>Pendiente</Insignia>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
