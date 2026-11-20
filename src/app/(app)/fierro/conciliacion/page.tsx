import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { Notice, Code, PageHeader, EmptyState } from "@/components/ui";
import { fierroStock, products, stock } from "@/db/schema";
import { pendingExports } from "@/lib/flows/exports";
import { requireSession } from "@/lib/session";
import { articleName } from "@/lib/article";

export const metadata = { title: "Conciliación con Fierro" };

export default async function Reconciliation() {
  const { db, company } = await requireSession("supervisor");
  const physical = db.select({ productId: stock.productId, total: sql<number>`sum(${stock.quantity})`.as("total") }).from(stock).where(eq(stock.companyId, company.id)).groupBy(stock.productId).as("fisico");
  const inWarehouse = sql<number>`coalesce(${physical.total}, 0)`;
  const inFierro = sql<number>`coalesce(${fierroStock.quantity}, 0)`;
  const rows = await db
    .select({ id: products.id, title: products.title, code: products.barcode, warehouse: inWarehouse.mapWith(Number), fierro: inFierro.mapWith(Number) })
    .from(products)
    .leftJoin(fierroStock, and(eq(fierroStock.productId, products.id), eq(fierroStock.companyId, company.id)))
    .leftJoin(physical, eq(physical.productId, products.id))
    .where(and(eq(products.companyId, company.id), sql`${inWarehouse} <> ${inFierro}`))
    .orderBy(sql`abs(${inWarehouse} - ${inFierro}) desc`, products.title)
    .limit(300);
  const unsent = (await pendingExports(db, company.id)).length;

  return (
    <>
      <PageHeader title="Conciliación con Fierro" back={{ href: "/fierro", text: "Fierro" }} />
      {unsent > 0 && (
        <div className="mb-6">
          <Notice tone="warn">
            Hay {unsent} {unsent === 1 ? "documento sin cargar" : "documentos sin cargar"} en Fierro. Parte de estas diferencias desaparecerán cuando los cargues.{" "}
            <Link href="/fierro" className="font-semibold underline underline-offset-[3px]">
              Ver pendientes
            </Link>
          </Notice>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Sin diferencias de stock">No hay ninguna diferencia de stock.</EmptyState>
      ) : (
        <>
          <p className="mb-3 max-w-[70ch] text-sm text-muted">
            {rows.length === 300 ? "Las 300 diferencias más grandes" : `${rows.length} artículos con diferencia`}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th className="hidden sm:table-cell">Código</th>
                  <th className="hidden text-right sm:table-cell">Depósito</th>
                  <th className="hidden text-right sm:table-cell">Fierro</th>
                  <th className="text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/stock/${f.id}`} className="link">
                        {articleName(f.title)}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted sm:hidden">
                        <Code>{f.code}</Code>
                        <span>
                          Depósito {f.warehouse} · Fierro {f.fierro}
                        </span>
                      </span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <Code>{f.code}</Code>
                    </td>
                    <td className="hidden text-right sm:table-cell">{f.warehouse}</td>
                    <td className="hidden text-right sm:table-cell">{f.fierro}</td>
                    <td className={`text-right font-semibold ${f.warehouse < f.fierro ? "text-danger" : "text-ok"}`}>
                      {f.warehouse > f.fierro ? "+" : ""}
                      {f.warehouse - f.fierro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
