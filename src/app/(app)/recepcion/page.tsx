import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ActionForm } from "@/components/ScanForm";
import { NewButton } from "@/components/NewButton";
import { PageHeader, shortDate, Badge, plural, EmptyRow } from "@/components/ui";
import { receivingLines, receivings, suppliers } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { create } from "./actions";
import { SupplierSelect } from "./SupplierSelect";

export const metadata = { title: "Recepción" };

export default async function Receivings() {
  const { db, company } = await requireSession();
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
    .where(and(eq(receivings.companyId, company.id)))
    .groupBy(receivings.id, suppliers.name)
    .orderBy(desc(receivings.date))
    .limit(60);
  const openList = rows.filter((f) => f.r.status !== "closed").reverse();
  const closedList = rows.filter((f) => f.r.status === "closed").slice(0, 8);

  return (
    <>
      <PageHeader title="Recepción">
        <NewButton title="Nueva recepción sin aviso">
          <ActionForm action={create} button="Crear recepción" className="space-y-3 [&>button]:w-full">
            <div>
              <label htmlFor="supplier" className="field-label">
                Proveedor
              </label>
              <SupplierSelect options={supplierList.map((x) => ({ value: String(x.id), label: x.name }))} />
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
                <th className="hidden text-right sm:table-cell">Títulos</th>
                <th className="hidden text-right sm:table-cell">Esperadas</th>
                <th className="hidden md:table-cell">Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {openList.length === 0 && (
                <EmptyRow columns={6} title="No hay recepciones abiertas">
                  Las que avisa Fierro aparecen solas. Si llegó algo sin aviso, tocá Nueva.
                </EmptyRow>
              )}
              {openList.map(({ r, supplier, titles, expected, received }) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/recepcion/${r.id}`} className="link doc-number">
                      {r.number}
                    </Link>
                  </td>
                  <td>
                    <span className="font-medium">{supplier}</span>
                    <span className="block text-muted md:hidden">
                      <span className="sm:hidden">
                        {plural(titles, "título", "títulos")} · {r.fierroId ? `${expected} unidades esperadas` : "sin aviso de Fierro"} ·{" "}
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

      {closedList.length > 0 && (
        <section className="mt-8 lg:mt-6">
          <h2 className="section-title">Últimas cerradas</h2>
          <ul className="ruled-list framed">
            {closedList.map(({ r, supplier, received }) => (
              <li key={r.id}>
                <Link href={`/recepcion/${r.id}`} className="row justify-between">
                  <span className="min-w-0">
                    <span className="doc-number">{r.number}</span> · {supplier}
                  </span>
                  <span className="text-sm whitespace-nowrap text-muted">{received} unidades</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
