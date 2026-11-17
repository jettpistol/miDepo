import Link from "next/link";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { Icon } from "@/components/Icon";
import { Code, PageHeader, Badge, ShelfMark, EmptyState } from "@/components/ui";
import { products, stock, locations } from "@/db/schema";
import { containsText } from "@/lib/lookup";
import { requireSession } from "@/lib/session";
import { StockSearch } from "./StockSearch";

export const metadata = { title: "Stock" };

const TYPE_LABEL = { book: "Libro", floppy: "Grapa", variant: "Variante", pack: "Pack" } as const;

export default async function Stock({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db, company } = await requireSession();
  const q = ((await searchParams).q ?? "").trim();

  const [location] = q ? await db.select().from(locations).where(and(eq(locations.companyId, company.id), eq(locations.code, q.toUpperCase()))) : [];
  const found = q
    ? await db
        .select()
        .from(products)
        .where(and(eq(products.companyId, company.id), or(eq(products.barcode, q), eq(products.isbn, q), eq(products.internalCode, q.toUpperCase()), containsText(products.title, q), containsText(products.author, q))))
        .orderBy(asc(products.title))
        .limit(50)
    : [];
  const totals = new Map<number, number>();
  if (found.length > 0) {
    const sums = await db.select({ productId: stock.productId, n: sql<number>`sum(${stock.quantity})`.mapWith(Number) }).from(stock).where(inArray(stock.productId, found.map((p) => p.id))).groupBy(stock.productId);
    for (const s of sums) totals.set(s.productId, s.n);
  }

  return (
    <>
      <PageHeader title="Stock" />
      <StockSearch initial={q} />

      {location && (
        <Link href={`/ubicaciones/${location.id}`} className="group mb-6 flex max-w-xl items-center gap-4 rounded-control border border-accent-text/30 bg-accent-soft px-3 py-3 lg:py-2 transition-colors duration-150 hover:border-accent-text">
          <ShelfMark code={location.code} size="md" />
          <span className="min-w-0 flex-1 text-sm text-muted">Es una ubicación</span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text">
            Ver qué hay <Icon name="arrow" className="size-4" />
          </span>
        </Link>
      )}

      {q && found.length === 0 && !location && <EmptyState icon="stock" title={`Nada coincide con "${q}"`}>Probá con menos palabras o con el código de barras completo.</EmptyState>}

      {found.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Título</th>
                <th className="hidden md:table-cell">Autor</th>
                <th className="hidden sm:table-cell">Código</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {found.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/stock/${p.id}`} className="link">
                      {p.title}
                    </Link>
                    {p.type !== "book" && (
                      <>
                        {" "}
                        <Badge>{TYPE_LABEL[p.type]}</Badge>
                      </>
                    )}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted md:hidden">
                      <span className="sm:hidden">
                        <Code>{p.barcode}</Code>
                      </span>
                      {p.author}
                    </span>
                  </td>
                  <td className="hidden text-muted md:table-cell">{p.author}</td>
                  <td className="hidden sm:table-cell">
                    <Code>{p.barcode}</Code>
                  </td>
                  <td className={`text-right text-base font-bold tabular-nums ${totals.get(p.id) ? "" : "text-muted/60"}`}>{totals.get(p.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {found.length === 50 && <p className="mt-3 text-sm text-muted">Se muestran los primeros 50.</p>}
    </>
  );
}
