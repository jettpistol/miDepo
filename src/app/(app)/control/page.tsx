import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { PageHeader, Badge, EmptyRow } from "@/components/ui";
import { customers, orderLines, orders, users } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { hotkey } from "@/lib/hotkeys";

export const metadata = { title: "Control" };

const picker = alias(users, "picker");

export default async function Control() {
  const { db, company, user } = await requireSession();
  const rows = await db
    .select({
      p: orders,
      customer: customers.name,
      pickedBy: picker.name,
      picked: sql<number>`coalesce(sum(${orderLines.picked}), 0)`.mapWith(Number),
      checked: sql<number>`coalesce(sum(${orderLines.checked}), 0)`.mapWith(Number),
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(picker, eq(picker.id, orders.takenBy))
    .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(and(eq(orders.companyId, company.id), eq(orders.status, "to_control")))
    .groupBy(orders.id, customers.name, picker.name)
    .orderBy(desc(orders.urgent), asc(orders.date));
  const mine = (p: typeof orders.$inferSelect) => !company.samePersonChecks && p.takenBy === user.id;
  const first = rows.findIndex((r) => !mine(r.p));

  return (
    <>
      <PageHeader title="Control" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th className="hidden sm:table-cell">Preparó</th>
              <th className="text-right">Unidades</th>
              <th>Control</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, customer, pickedBy, picked, checked }, i) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/control/${p.id}`} className="link doc-number" {...(i === first ? hotkey("primary", `Controlar ${p.number}`) : {})}>
                    {p.number}
                  </Link>
                </td>
                <td>
                  <span className="font-medium">{customer}</span>
                  {p.urgent && (
                    <>
                      {" "}
                      <Badge tone="danger">Urgente</Badge>
                    </>
                  )}
                  <span className="block text-muted sm:hidden">Preparó {pickedBy ?? "—"}</span>
                </td>
                <td className="hidden sm:table-cell">{pickedBy ?? "—"}</td>
                <td className="text-right font-semibold">{picked}</td>
                <td>
                  {mine(p) ? <Badge>Lo controla otra persona</Badge> : checked > 0 ? <Badge tone="accent">{checked} de {picked}</Badge> : <Badge>Sin empezar</Badge>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow columns={5} title="No hay pedidos esperando control." />}
          </tbody>
        </table>
      </div>
    </>
  );
}
