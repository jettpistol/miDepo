import Link from "next/link";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { LiveSearch } from "@/components/LiveSearch";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { ReceivingsTable } from "./ReceivingsTable";
import { receivingRows } from "@/lib/lists";
import { ActionForm } from "@/components/ScanForm";
import { NewButton } from "@/components/NewButton";
import { PageHeader, shortDate, Badge, plural, EmptyRow } from "@/components/ui";
import { receivingLines, receivings, suppliers } from "@/db/schema";
import { can, requireSession } from "@/lib/session";
import { create } from "./actions";
import { SupplierSelect } from "./SupplierSelect";
import { hotkey } from "@/lib/hotkeys";

export const metadata = { title: "Recepción" };

export default async function Receivings({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { db, company, user } = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const supplierList = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.companyId, company.id)).orderBy(asc(suppliers.name));
  const rows = await db
    .select({
      r: receivings,
      supplier: suppliers.name,
      titles: sql<number>`count(${receivingLines.id})`.mapWith(Number),
      expected: sql<number>`coalesce(sum(${receivingLines.expected}), 0)`.mapWith(Number),
      received: sql<number>`coalesce(sum(${receivingLines.received}), 0)`.mapWith(Number),
    })
    .from(receivings)
    .innerJoin(suppliers, eq(suppliers.id, receivings.supplierId))
    .leftJoin(receivingLines, eq(receivingLines.receivingId, receivings.id))
    .where(and(eq(receivings.companyId, company.id), ne(receivings.status, "closed")))
    .groupBy(receivings.id, suppliers.name)
    .orderBy(asc(receivings.date));
  const openList = rows;
  const page = requestedPage(sp.pagina);
  const closed = await receivingRows(db, company.id, eq(receivings.status, "closed"), paging(page), q);

  return (
    <>
      <PageHeader title="Recepción">
        <NewButton title="Nueva recepción sin aviso">
          <ActionForm action={create} button="Crear recepción" className="space-y-3 [&>button]:w-full">
            <div>
              <label htmlFor="supplier" className="field-label">
                Proveedor
              </label>
              <SupplierSelect options={supplierList.map((x) => ({ value: String(x.id), label: x.name }))} canCreate={can(user.role, "supervisor")} />
            </div>
          </ActionForm>
        </NewButton>
      </PageHeader>
      <section>
        <h2 className="section-title">
          Abiertas <small>{openList.length}</small>
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Recepción</th>
                <th>Origen</th>
                <th className="hidden text-right sm:table-cell">Artículos</th>
                <th className="hidden text-right sm:table-cell">Esperadas</th>
                <th className="hidden md:table-cell">Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {openList.length === 0 && (
                <EmptyRow columns={6} title="No hay recepciones abiertas">
                  Las que avisa Fierro aparecen automáticamente. Si llegó algo sin aviso, toca Nueva.
                </EmptyRow>
              )}
              {openList.map(({ r, supplier, titles, expected, received }, i) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/recepcion/${r.id}`} className="link doc-number" {...(i === 0 ? hotkey("primary", `Abrir ${r.number}`) : {})}>
                      {r.number}
                    </Link>
                  </td>
                  <td>
                    <span className="font-medium">{supplier}</span>
                    <span className="block text-muted md:hidden">
                      <span className="sm:hidden">
                        {plural(titles, "artículo", "artículos")} · {r.fierroId ? `${expected} unidades esperadas` : "sin aviso de Fierro"} ·{" "}
                      </span>
                      {shortDate(r.date)}
                    </span>
                  </td>
                  <td className="hidden text-right sm:table-cell">{titles}</td>
                  <td className="hidden text-right sm:table-cell">{r.fierroId ? <span className="font-semibold">{expected}</span> : <span className="text-muted">sin aviso de Fierro</span>}</td>
                  <td className="hidden whitespace-nowrap text-muted md:table-cell">{shortDate(r.date)}</td>
                  <td>{r.status === "in_progress" ? <Badge tone="accent">En curso · {received} contadas</Badge> : <Badge>Sin empezar</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="cerradas" className="mt-8 lg:mt-6">
        <h2 className="section-title">
          Cerradas <small>{closed.total}</small>
        </h2>
        {(closed.total > 0 || q) && <LiveSearch placeholder="Número o proveedor" className="mb-3 max-w-md" />}
        <ReceivingsTable rows={closed.rows} empty={q ? { title: `Ninguna recepción cerrada coincide con "${q}"` } : { title: "Todavía no hay recepciones cerradas" }} />
        <Pager base="/recepcion" params={{ q }} page={page} total={closed.total} />
      </section>
    </>
  );
}
