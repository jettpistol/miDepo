import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { ActionForm } from "@/components/ScanForm";
import { PageHeader, shortDate, Badge, plural, EmptyState } from "@/components/ui";
import { receivingLines, receivings } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { create } from "./actions";

export const metadata = { title: "Recepción" };

export default async function Receivings() {
  const { db, company } = await requireSession();
  const rows = await db
    .select({
      r: receivings,
      titles: sql<number>`count(${receivingLines.id})`.mapWith(Number),
      expected: sql<number>`coalesce(sum(${receivingLines.expected}), 0)`.mapWith(Number),
      received: sql<number>`coalesce(sum(${receivingLines.received}), 0)`.mapWith(Number),
    })
    .from(receivings)
    .leftJoin(receivingLines, eq(receivingLines.receivingId, receivings.id))
    .where(and(eq(receivings.companyId, company.id)))
    .groupBy(receivings.id)
    .orderBy(desc(receivings.date))
    .limit(60);
  const openList = rows.filter((f) => f.r.status !== "closed").reverse();
  const closedList = rows.filter((f) => f.r.status === "closed").slice(0, 8);

  return (
    <>
      <PageHeader title="Recepción" />
      {openList.length === 0 ? (
        <EmptyState title="No hay recepciones abiertas">Cuando Fierro avise un ingreso va a aparecer acá. Si llegó algo sin aviso, creá la recepción abajo.</EmptyState>
      ) : (
        <div className="overflow-x-auto border-y border-line">
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
              {openList.map(({ r, titles, expected, received }) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/recepcion/${r.id}`} className="link doc-number">
                      {r.number}
                    </Link>
                  </td>
                  <td>
                    <span className="font-medium">{r.supplier}</span>
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
      )}

      <section className="mt-9">
        <h2 className="section-title">Llegó algo sin aviso</h2>
        <ActionForm action={create} button="Crear recepción" className="flex flex-wrap items-start gap-3">
          <input name="supplier" className="field max-w-sm flex-1 basis-64" placeholder="¿De dónde viene? (imprenta, feria, proveedor…)" aria-label="Origen de la mercadería" required />
        </ActionForm>
      </section>

      {closedList.length > 0 && (
        <section className="mt-9">
          <h2 className="section-title">Últimas cerradas</h2>
          <ul className="ruled-list">
            {closedList.map(({ r, received }) => (
              <li key={r.id}>
                <Link href={`/recepcion/${r.id}`} className="row justify-between">
                  <span className="min-w-0">
                    <span className="doc-number">{r.number}</span> · {r.supplier}
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
