import Link from "next/link";
import { CommentCount } from "@/components/comments/Comments";
import { commentCounts } from "@/lib/flows/comments";
import { and, asc, eq, sql, desc } from "drizzle-orm";
import { PageHeader, Badge, plural, EmptyState, Condition, SALE_MODE } from "@/components/ui";
import { customers, orderLines, orders } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { hotkey } from "@/lib/hotkeys";
import { AssigneeCell, assignees } from "@/components/Assignee";

export const metadata = { title: "Empaque" };

export default async function Packing() {
  const session = await requireSession();
  const { db, company, user } = session;
  const a = await assignees(session);
  const rows = await db
    .select({
      p: orders,
      customer: customers.name,
      picked: sql<number>`coalesce(sum(${orderLines.picked}), 0)`.mapWith(Number),
      packed: sql<number>`coalesce(sum(${orderLines.packed}), 0)`.mapWith(Number),
      order: sql<number>`coalesce(sum(${orderLines.quantity}), 0)`.mapWith(Number),
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(and(eq(orders.companyId, company.id), eq(orders.status, "picked")))
    .groupBy(orders.id, customers.name)
    .orderBy(desc(orders.urgent), asc(orders.date));

  // When the order skipped Control, packing is the check: the picker may not do it if the company says so.
  const mine = (p: typeof orders.$inferSelect) => !company.samePersonChecks && p.controlledBy == null && p.sameCheckAllowedBy == null && p.takenBy === user.id;
  const notes = await commentCounts(db, company.id, "order", rows.map((r) => r.p.id));
  const first = rows.findIndex((r) => !mine(r.p));

  return (
    <>
      <PageHeader title="Empaque" />
      {rows.length === 0 ? (
        <EmptyState icon="packing" title="Sin pedidos por empacar" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th className="hidden sm:table-cell">Condición</th>
                <th className="hidden sm:table-cell">Asignado</th>
                <th className="hidden text-right sm:table-cell">Preparadas</th>
                <th className="hidden text-right sm:table-cell">Faltantes</th>
                <th>Cajas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, customer, picked, packed, order }, i) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/empaque/${p.id}`} className="link doc-number" {...(i === first ? hotkey("primary", `Empacar ${p.number}`) : {})}>
                      {p.number}
                    </Link>{" "}
                    <CommentCount n={notes.get(p.id)} />
                  </td>
                  <td>
                    <span className="font-medium">{customer}</span>
                    {p.urgent && (
                      <>
                        {" "}
                        <Badge tone="danger">Urgente</Badge>
                      </>
                    )}
                    <span className="block text-muted sm:hidden">
                      {SALE_MODE[p.saleMode]} · {plural(picked, "unidad preparada", "unidades preparadas")}
                      {picked < order && ` · ${order - picked} faltantes`}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <Condition mode={p.saleMode} href={`/empaque/${p.id}`} />
                  </td>
                  <td className="hidden sm:table-cell">
                    <AssigneeCell a={a} kind="order" id={p.id} value={p.assignedTo} />
                  </td>
                  <td className="hidden text-right font-semibold sm:table-cell">{picked}</td>
                  <td className={`hidden text-right sm:table-cell ${picked < order ? "font-semibold text-danger" : "text-muted"}`}>{picked < order ? order - picked : "—"}</td>
                  <td>
                    {mine(p) ? (
                      <Badge>Lo empaca otra persona</Badge>
                    ) : packed > 0 ? (
                      <Badge tone="accent">
                        {packed} de {picked} en cajas
                      </Badge>
                    ) : (
                      <Badge>Sin empezar</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
