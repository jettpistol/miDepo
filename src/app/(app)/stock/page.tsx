import Link from "next/link";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { Icono } from "@/components/Icono";
import { Codigo, Encabezado, Insignia, Tejuelo, Vacio } from "@/components/ui";
import { productos, stock, ubicaciones } from "@/db/schema";
import { contiene } from "@/lib/consulta";
import { requerir } from "@/lib/sesion";
import { Busqueda } from "./Busqueda";

export const metadata = { title: "Stock" };

const TIPO = { libro: "Libro", grapa: "Grapa", variante: "Variante", pack: "Pack" } as const;

export default async function Stock({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db, empresa } = await requerir();
  const q = ((await searchParams).q ?? "").trim();

  const [ubicacion] = q ? await db.select().from(ubicaciones).where(and(eq(ubicaciones.empresaId, empresa.id), eq(ubicaciones.codigo, q.toUpperCase()))) : [];
  const encontrados = q
    ? await db
        .select()
        .from(productos)
        .where(and(eq(productos.empresaId, empresa.id), or(eq(productos.codigoBarras, q), eq(productos.isbn, q), eq(productos.codigoInterno, q.toUpperCase()), contiene(productos.titulo, q), contiene(productos.autor, q))))
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
      <Encabezado titulo="Stock" />
      <Busqueda inicial={q} />

      {ubicacion && (
        <Link href={`/ubicaciones/${ubicacion.id}`} className="group mb-6 flex max-w-xl items-center gap-4 rounded-control border border-acento-texto/30 bg-acento-suave px-3 py-3 transition-colors duration-150 hover:border-acento-texto">
          <Tejuelo codigo={ubicacion.codigo} tam="md" />
          <span className="min-w-0 flex-1 text-sm text-suave">Es una ubicación</span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-acento-texto">
            Ver qué hay <Icono nombre="flecha" className="size-4" />
          </span>
        </Link>
      )}

      {q && encontrados.length === 0 && !ubicacion && <Vacio icono="stock" titulo={`Nada coincide con "${q}"`}>Probá con menos palabras o con el código de barras completo.</Vacio>}

      {encontrados.length > 0 && (
        <div className="overflow-x-auto border-y border-borde">
          <table className="tabla">
            <thead>
              <tr>
                <th>Título</th>
                <th className="hidden md:table-cell">Autor</th>
                <th className="hidden sm:table-cell">Código</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {encontrados.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/stock/${p.id}`} className="enlace">
                      {p.titulo}
                    </Link>
                    {p.tipo !== "libro" && (
                      <>
                        {" "}
                        <Insignia>{TIPO[p.tipo]}</Insignia>
                      </>
                    )}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-suave md:hidden">
                      <span className="sm:hidden">
                        <Codigo>{p.codigoBarras}</Codigo>
                      </span>
                      {p.autor}
                    </span>
                  </td>
                  <td className="hidden text-suave md:table-cell">{p.autor}</td>
                  <td className="hidden sm:table-cell">
                    <Codigo>{p.codigoBarras}</Codigo>
                  </td>
                  <td className={`text-right text-base font-bold tabular-nums ${totales.get(p.id) ? "" : "text-suave/60"}`}>{totales.get(p.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {encontrados.length === 50 && <p className="mt-3 text-sm text-suave">Se muestran los primeros 50.</p>}
    </>
  );
}
