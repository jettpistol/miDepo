import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { productos } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { Etiquetas } from "../../Etiquetas";

/** Etiquetas para artículos sin ISBN (grapas, variantes, packs): llevan el código interno. */
export default async function EtiquetasProductos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db, empresa } = await requerir();
  const q = ((await searchParams).q ?? "").trim().replace(/[%_\\]/g, "");
  const filas = q
    ? await db
        .select({ codigo: productos.codigoBarras, titulo: productos.titulo })
        .from(productos)
        .where(and(eq(productos.empresaId, empresa.id), isNull(productos.isbn), ilike(productos.titulo, `%${q.split(/\s+/).join("%")}%`)))
        .orderBy(asc(productos.titulo))
        .limit(240)
    : [];
  return (
    <>
      <form className="no-imprimir mb-4 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por título (solo artículos sin ISBN)" className="w-full rounded-lg border border-neutral-400 px-3 py-2" />
        <button className="rounded-lg border border-neutral-400 px-3 py-2 font-semibold">Buscar</button>
      </form>
      {q ? <Etiquetas items={filas} /> : <p className="py-10 text-center">Buscá una serie o un título para armar sus etiquetas.</p>}
    </>
  );
}
