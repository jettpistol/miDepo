import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { ActionForm } from "@/components/ScanForm";
import { PageHeader, shortDate, Badge, plural } from "@/components/ui";
import { customers, returnLines, returns } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { create } from "./actions";
import { CustomerPicker } from "./CustomerPicker";

export const metadata = { title: "Devoluciones" };

export default async function Returns() {
  const { db, company } = await requireSession();
  const [list, rows] = await Promise.all([
    db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.companyId, company.id)).orderBy(asc(customers.name)),
    db
      .select({ d: returns, customer: customers.name, units: sql<number>`coalesce(sum(${returnLines.quantity}), 0)`.mapWith(Number) })
      .from(returns)
      .innerJoin(customers, eq(customers.id, returns.customerId))
      .leftJoin(returnLines, eq(returnLines.returnId, returns.id))
      .where(eq(returns.companyId, company.id))
      .groupBy(returns.id, customers.name)
      .orderBy(desc(returns.date))
      .limit(40),
  ]);

  return (
    <>
      <PageHeader title="Devoluciones" />
      <section className="mb-8 lg:mb-6">
        <h2 className="section-title">Llegó una devolución</h2>
        <ActionForm action={create} button="Empezar a revisar" className="flex flex-wrap items-start gap-3">
          <CustomerPicker customers={list} />
        </ActionForm>
      </section>

      {rows.length > 0 && (
        <section>
          <h2 className="section-title">
            Últimas devoluciones <small>{rows.length}</small>
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Devolución</th>
                  <th>Cliente</th>
                  <th className="hidden text-right sm:table-cell">Unidades</th>
                  <th className="hidden sm:table-cell">Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ d, customer, units }) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/devoluciones/${d.id}`} className="link doc-number">
                        {d.number}
                      </Link>
                    </td>
                    <td>
                      <span className="font-medium">{customer}</span>
                      <span className="block text-muted sm:hidden">
                        {plural(units, "unidad", "unidades")} · {shortDate(d.date)}
                      </span>
                    </td>
                    <td className="hidden text-right font-semibold sm:table-cell">{units}</td>
                    <td className="hidden whitespace-nowrap text-muted sm:table-cell">{shortDate(d.date)}</td>
                    <td>{d.status === "in_progress" ? <Badge tone="accent">En curso</Badge> : <Badge tone="ok">Cerrada</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
