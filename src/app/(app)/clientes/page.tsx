import Link from "next/link";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { LiveSearch } from "@/components/LiveSearch";
import { EmptyRow, PageHeader } from "@/components/ui";
import { listCustomers } from "@/lib/lists";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Clientes" };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { db, company } = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = requestedPage(sp.pagina);
  const { total, rows } = await listCustomers(db, company.id, q, paging(page));

  return (
    <>
      <PageHeader title="Clientes" />
      <LiveSearch placeholder="Nombre, localidad o provincia" />
      <h2 className="section-title">
        {q ? "Resultados" : "Todos los clientes"} <small>{total}</small>
      </h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th className="hidden sm:table-cell">Localidad</th>
              <th className="text-right">Pedidos</th>
              <th className="hidden text-right sm:table-cell">Devoluciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow columns={4} title={q ? `Ningún cliente coincide con "${q}"` : "Todavía no hay clientes"}>
                {q ? undefined : "Los clientes llegan de Fierro al sincronizar."}
              </EmptyRow>
            )}
            {rows.map(({ c, orders, returns }) => {
              const place = [c.city, c.province].filter(Boolean).join(", ");
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clientes/${c.id}`} className="link">
                      {c.name}
                    </Link>
                    {place && <span className="block text-muted sm:hidden">{place}</span>}
                  </td>
                  <td className="hidden text-muted sm:table-cell">{place || "—"}</td>
                  <td className="text-right font-semibold tabular-nums">{orders}</td>
                  <td className="hidden text-right tabular-nums sm:table-cell">{returns}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager base="/clientes" params={{ q }} page={page} total={total} />
    </>
  );
}
