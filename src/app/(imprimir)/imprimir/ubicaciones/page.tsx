import { and, asc, eq, like } from "drizzle-orm";
import { ubicaciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { Etiquetas } from "../../Etiquetas";

export default async function EtiquetasUbicaciones({ searchParams }: { searchParams: Promise<{ prefijo?: string; exacta?: string }> }) {
  const { db, empresa } = await requerir();
  const sp = await searchParams;
  const prefijo = (sp.prefijo ?? "").trim().toUpperCase().replace(/[%_]/g, "");
  const filas = await db
    .select({ codigo: ubicaciones.codigo })
    .from(ubicaciones)
    .where(and(eq(ubicaciones.empresaId, empresa.id), eq(ubicaciones.tipo, "estanteria"), eq(ubicaciones.activa, true), sp.exacta ? eq(ubicaciones.codigo, prefijo) : like(ubicaciones.codigo, `${prefijo}%`)))
    .orderBy(asc(ubicaciones.codigo))
    .limit(960);
  return (
    <>
      <p className="no-imprimir mb-4 text-sm text-neutral-700">
        {filas.length} etiquetas{prefijo ? ` que empiezan con ${prefijo}` : ""} ({Math.ceil(filas.length / 24)} hojas). {filas.length === 960 && "Se imprimen como máximo 960 por vez: filtrá por pasillo."}
      </p>
      <Etiquetas items={filas} />
    </>
  );
}
