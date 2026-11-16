import Link from "next/link";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Icono } from "@/components/Icono";
import { Codigo, Encabezado, Insignia, Vacio } from "@/components/ui";
import { productos, stock, ubicaciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";

export const metadata = { title: "Stock" };

const TIPO = { libro: "Libro", grapa: "Grapa", variante: "Variante", pack: "Pack" } as const;

export default async function Stock({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db, empresa } = await requerir();
  const q = ((await searchParams).q ?? "").trim();
  const patron = `%${q.replace(/[%_\\]/g, "").split(/\s+/).join("%")}%`;

  const [ubicacion] = q ? await db.select().from(ubicaciones).where(and(eq(ubicaciones.empresaId, empresa.id), eq(ubicaciones.codigo, q.toUpperCase()))) : [];
  const encontrados = q
    ? await db
        .select()
        .from(productos)
        .where(and(eq(productos.empresaId, empresa.id), or(eq(productos.codigoBarras, q), eq(productos.isbn, q), eq(productos.codigoInterno, q.toUpperCase()), ilike(productos.titulo, patron), ilike(productos.autor, patron))))
        .orderBy(asc(productos.titulo))
        .limit(50)
    : [];
  const totales = new Map<number, number>();
  if (encontrados.length > 0) {
    const sumas = await db.select({ productoId: stock.productoId, n: sql<number>`sum(${stock.cantidad})`.mapWith(Number) }).from(stock).where(inArray(stock.productoId, encontrados.map((p) => p.id))).groupBy(stock.productoId);
    for (const s of sumas) totales.set(s.productoId, s.n);
  }

  return (
    <>
      <Encabezado titulo="Stock" bajada="Buscá un título para saber dónde está, o escaneá un estante para ver qué tiene." />
      <form className="mb-5 flex max-w-xl gap-2" role="search">
        <input name="q" defaultValue={q} className="campo" placeholder="Título, autor, ISBN, código o ubicación" aria-label="Buscar" autoFocus />
        <button className="boton px-4" aria-label="Buscar">
          <Icono nombre="stock" />
        </button>
      </form>

      {ubicacion && (
        <Link href={`/ubicaciones/${ubicacion.id}`} className="tarjeta mb-4 flex items-center justify-between gap-3 border-acento-texto/40 bg-acento-suave p-4">
          <span>
            <span className="block text-sm text-suave">Es una ubicación</span>
            <span className="font-mono text-xl font-bold">{ubicacion.codigo}</span>
          </span>
          <span className="enlace">Ver qué hay</span>
        </Link>
      )}

      {q && encontrados.length === 0 && !ubicacion && <Vacio icono="stock" titulo={`Nada coincide con "${q}"`}>Probá con menos palabras o con el código de barras completo.</Vacio>}

      {encontrados.length > 0 && (
        <ul className="tarjeta divide-y divide-borde/70">
          {encontrados.map((p) => (
            <li key={p.id}>
              <Link href={`/stock/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-hundido">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.titulo}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-suave">
                    <Codigo>{p.codigoBarras}</Codigo> {p.autor} {p.tipo !== "libro" && <Insignia>{TIPO[p.tipo]}</Insignia>}
                  </span>
                </span>
                <span className={`text-xl font-bold tabular-nums ${totales.get(p.id) ? "" : "text-suave/50"}`}>{totales.get(p.id) ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {encontrados.length === 50 && <p className="mt-2 text-sm text-suave">Se muestran los primeros 50. Afiná la búsqueda para ver menos.</p>}
    </>
  );
}
