import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { BotonAccion } from "@/components/Escaneo";
import { Icono } from "@/components/Icono";
import { Codigo, Encabezado, Insignia, Tejuelo } from "@/components/ui";
import { productos, stock, ubicaciones } from "@/db/schema";
import { puede, requerir } from "@/lib/sesion";
import { nombreUbicacion } from "@/lib/stock";
import { alternar } from "../acciones";

export default async function Ubicacion({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, empresa, usuario } = await requerir();
  const [u] = await db.select().from(ubicaciones).where(and(eq(ubicaciones.id, id), eq(ubicaciones.empresaId, empresa.id)));
  if (!u) notFound();
  const contenido = await db.select({ s: stock, p: productos }).from(stock).innerJoin(productos, eq(productos.id, stock.productoId)).where(eq(stock.ubicacionId, id)).orderBy(asc(productos.titulo)).limit(500);
  const esEstante = u.tipo === "estanteria";
  const supervisor = puede(usuario.rol, "supervisor");

  return (
    <>
      <Encabezado titulo={esEstante ? <Tejuelo codigo={u.codigo} tam="md" className="text-[26px]" /> : nombreUbicacion(u)} volver={supervisor && esEstante ? { href: "/ubicaciones", texto: "Ubicaciones" } : { href: "/stock", texto: "Stock" }} bajada={`${contenido.length} títulos · ${contenido.reduce((s, c) => s + c.s.cantidad, 0)} unidades`}>
        {!esEstante && <Tejuelo codigo={u.codigo} tam="md" />}
        {!u.activa && <Insignia tono="alerta">Dada de baja</Insignia>}
        {esEstante && (
          <Link href={`/imprimir/ubicaciones?prefijo=${encodeURIComponent(u.codigo)}&exacta=1`} target="_blank" className="boton-suave">
            <Icono nombre="imprimir" /> Etiqueta
          </Link>
        )}
        {esEstante && supervisor && (
          <BotonAccion accion={alternar} ocultos={{ id }} clase="boton-suave" motivo={u.activa && contenido.length > 0 ? "Para darla de baja, primero mové los libros." : undefined}>
            {u.activa ? "Dar de baja" : "Reactivar"}
          </BotonAccion>
        )}
      </Encabezado>
      {contenido.length === 0 ? (
        <p className="border-y border-borde px-2 py-8 text-sm text-suave lg:px-3">Este lugar está vacío.</p>
      ) : (
        <div className="max-w-4xl overflow-x-auto border-y border-borde">
          <table className="tabla">
            <thead>
              <tr>
                <th>Título</th>
                <th className="hidden sm:table-cell">Código</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {contenido.map(({ s, p }) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/stock/${p.id}`} className="enlace">
                      {p.titulo}
                    </Link>
                    <span className="mt-0.5 block sm:hidden">
                      <Codigo>{p.codigoBarras}</Codigo>
                    </span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <Codigo>{p.codigoBarras}</Codigo>
                  </td>
                  <td className="text-right text-base font-bold tabular-nums">{s.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
