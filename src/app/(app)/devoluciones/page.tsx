import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { NewButton } from "@/components/NewButton";
import { ActionForm } from "@/components/ScanForm";
import { Select } from "@/components/Select";
import { Badge, EmptyRow, PageHeader, plural, shortDate } from "@/components/ui";
import { customers, returnLines, returns } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { create } from "./actions";
import { hotkey } from "@/lib/hotkeys";

export const metadata = { title: "Devoluciones" };

type Row = { d: typeof returns.$inferSelect; customer: string; units: number };

function ReturnsTable({ rows, empty }: { rows: Row[]; empty?: { title: string; text: string } }) {
  return (
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
          {rows.length === 0 && empty && (
            <EmptyRow columns={5} title={empty.title}>
              {empty.text}
            </EmptyRow>
          )}
          {rows.map(({ d, customer, units }, i) => (
            <tr key={d.id}>
              <td>
                <Link href={`/devoluciones/${d.id}`} className="link doc-number" {...(i === 0 && d.status === "in_progress" ? hotkey("primary", `Abrir ${d.number}`) : {})}>
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
              <td className="w-px">{d.status === "in_progress" ? <Badge tone="accent">En curso</Badge> : <Badge tone="ok">Cerrada</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Returns() {
  const { db, company } = await requireSession();
  const [list, rows] = await Promise.all([
    db.select({ id: customers.id, name: customers.name, city: customers.city }).from(customers).where(eq(customers.companyId, company.id)).orderBy(asc(customers.name)),
    db
      .select({ d: returns, customer: customers.name, units: sql<number>`coalesce(sum(${returnLines.quantity}), 0)`.mapWith(Number) })
      .from(returns)
      .innerJoin(customers, eq(customers.id, returns.customerId))
      .leftJoin(returnLines, eq(returnLines.returnId, returns.id))
      .where(eq(returns.companyId, company.id))
      .groupBy(returns.id, customers.name)
      .orderBy(desc(returns.date))
      .limit(60),
  ]);
  const inProgress = rows.filter((r) => r.d.status === "in_progress");
  const closed = rows.filter((r) => r.d.status !== "in_progress").slice(0, 20);

  return (
    <>
      <PageHeader title="Devoluciones">
        <NewButton title="Nueva devolución">
          <ActionForm action={create} button="Empezar a revisar" className="space-y-3 [&>button]:w-full">
            <div>
              <label htmlFor="customer" className="field-label">
                Cliente que devuelve
              </label>
              <Select
                name="customerId"
                id="customer"
                options={list.map((c) => ({ value: String(c.id), label: c.name, detail: c.city ?? undefined }))}
                required
                requiredMessage="Elegí el cliente de la lista."
                placeholder="Elegí el cliente"
                searchPlaceholder="Buscar cliente o localidad…"
                empty="Ningún cliente coincide. Los clientes vienen de Fierro: si falta uno, sincronizá."
              />
            </div>
          </ActionForm>
        </NewButton>
      </PageHeader>

      <section className="mb-8 lg:mb-6">
        <h2 className="section-title">
          En curso <small>{inProgress.length}</small>
        </h2>
        <ReturnsTable rows={inProgress} empty={{ title: "No hay devoluciones en curso", text: "Cuando llegue una, tocá Nueva y elegí el cliente." }} />
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="section-title">
            Cerradas <small>{closed.length}</small>
          </h2>
          <ReturnsTable rows={closed} />
        </section>
      )}
    </>
  );
}
