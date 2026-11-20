import Link from "next/link";
import { and, asc, count, eq, inArray, or, sql } from "drizzle-orm";
import { Icon } from "@/components/Icon";
import { Code, PageHeader, Badge, ShelfMark, EmptyRow } from "@/components/ui";
import { products, stock, locations } from "@/db/schema";
import { containsText } from "@/lib/lookup";
import { requireSession } from "@/lib/session";
import { Cover, ProductCards, ViewSwitch } from "@/components/ProductCards";
import { StockSearch } from "./StockSearch";
import { articleName } from "@/lib/article";

export const metadata = { title: "Stock" };

const TYPE_LABEL = { book: "Libro", floppy: "Grapa", variant: "Variante", pack: "Pack" } as const;
const PAGE = 50;
const fmt = (n: number) => n.toLocaleString("es-AR");

export default async function Stock({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { db, company, user } = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const [location] = q ? await db.select().from(locations).where(and(eq(locations.companyId, company.id), eq(locations.code, q.toUpperCase()))) : [];
  // Without a search the whole catalogue is listed, a page at a time; a search narrows it.
  const filter = and(eq(products.companyId, company.id), q ? or(eq(products.barcode, q), eq(products.isbn, q), eq(products.internalCode, q.toUpperCase()), containsText(products.title, q), containsText(products.author, q)) : undefined);
  const [{ n: total }] = await db.select({ n: count() }).from(products).where(filter);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(sp.pagina)) || 1));
  const found = await db
    .select()
    .from(products)
    .where(filter)
    .orderBy(asc(products.title))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  const pageHref = (n: number) => `/stock?${new URLSearchParams({ ...(q ? { q } : {}), ...(n > 1 ? { pagina: String(n) } : {}) })}`;
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

      <div className="mb-2 flex flex-wrap items-end justify-between gap-x-6">
        <h2 className="section-title mb-0 py-2 lg:py-1.5">
          {q ? "Resultados" : "Todos los artículos"} <small>{fmt(total)}</small>
        </h2>
        <ViewSwitch view={user.listView} />
      </div>
      {user.listView === "cards" ? (
        <ProductCards
          items={found.map((p) => ({ product: p, quantity: totals.get(p.id) ?? 0, extra: p.type !== "book" && <Badge>{TYPE_LABEL[p.type]}</Badge> }))}
          empty={
            <>
              <p className="font-semibold">{q ? `Nada coincide con "${q}"` : "Todavía no hay artículos"}</p>
              <p className="mx-auto mt-1 max-w-[60ch] text-sm text-muted">{q ? "Prueba con menos palabras o con el código de barras completo." : "Los artículos llegan de Fierro al sincronizar."}</p>
            </>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-0"><span className="sr-only">Portada</span></th>
                <th>Artículo</th>
                <th className="hidden md:table-cell">Autor</th>
                <th className="hidden sm:table-cell">Código</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {found.length === 0 && (
                <EmptyRow columns={5} title={q ? `Nada coincide con "${q}"` : "Todavía no hay artículos"}>
                  {q ? "Prueba con menos palabras o con el código de barras completo." : "Los artículos llegan de Fierro al sincronizar."}
                </EmptyRow>
              )}
              {found.map((p) => (
                <tr key={p.id}>
                  <td className="w-0 py-1.5! pr-0!">
                    <Cover productId={p.id} version={p.thumbVersion} className="h-14 w-10" />
                  </td>
                  <td>
                    <Link href={`/stock/${p.id}`} className="link">
                      {articleName(p.title)}
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
      {total > PAGE && (
        <nav aria-label="Páginas" className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
          <span>
            {fmt((page - 1) * PAGE + 1)}–{fmt(Math.min(page * PAGE, total))} de {fmt(total)}
          </span>
          <span className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="btn-sm" scroll={false}>
                <Icon name="arrow" className="size-4 rotate-180" /> Anterior
              </Link>
            ) : (
              <span className="btn-sm pointer-events-none opacity-55" aria-disabled="true">
                <Icon name="arrow" className="size-4 rotate-180" /> Anterior
              </span>
            )}
            {page < pages ? (
              <Link href={pageHref(page + 1)} className="btn-sm" scroll={false}>
                Siguiente <Icon name="arrow" className="size-4" />
              </Link>
            ) : (
              <span className="btn-sm pointer-events-none opacity-55" aria-disabled="true">
                Siguiente <Icon name="arrow" className="size-4" />
              </span>
            )}
          </span>
        </nav>
      )}
    </>
  );
}
