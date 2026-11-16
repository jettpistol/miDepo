import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { BotonAccion } from "@/components/Escaneo";
import { Icono } from "@/components/Icono";
import { Codigo, Encabezado, Insignia } from "@/components/ui";
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
      <Encabezado titulo={esEstante ? u.codigo : nombreUbicacion(u)} volver={supervisor && esEstante ? { href: "/ubicaciones", texto: "Ubicaciones" } : { href: "/stock", texto: "Stock" }} bajada={`${contenido.length} títulos · ${contenido.reduce((s, c) => s + c.s.cantidad, 0)} unidades`}>
        {!u.activa && <Insignia tono="alerta">Dada de baja</Insignia>}
        {esEstante && (
          <Link href={`/imprimir/ubicaciones?prefijo=${encodeURIComponent(u.codigo)}&exacta=1`} target="_blank" className="boton-suave">
            <Icono nombre="imprimir" /> Etiqueta
          </Link>
        )}
        {esEstante && supervisor && (
          <BotonAccion accion={alternar} ocultos={{ id }} clase="boton-suave">
            {u.activa ? "Dar de baja" : "Reactivar"}
          </BotonAccion>
        )}
      </Encabezado>
      {contenido.length === 0 ? (
        <p className="tarjeta p-6 text-center text-sm text-suave">Este lugar está vacío.</p>
      ) : (
        <ul className="tarjeta divide-y divide-borde/70">
          {contenido.map(({ s, p }) => (
            <li key={p.id}>
              <Link href={`/stock/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-hundido">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.titulo}</span>
                  <Codigo>{p.codigoBarras}</Codigo>
                </span>
                <span className="text-xl font-bold tabular-nums">{s.cantidad}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
