import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { PageHeader, Badge, plural, EmptyState } from "@/components/ui";
import { customers, orderLines, orders } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { hotkey } from "@/lib/hotkeys";
import { CommentCount } from "@/components/comments/Comments";
import { commentCounts } from "@/lib/flows/comments";

export const metadata = { title: "Empaque" };

export default async function Packing() {
  const { db, company } = await requireSession();
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
    .orderBy(asc(orders.date));
  const notes = await commentCounts(db, company.id, "order", rows.map((r) => r.p.id));

  return (
    <>
      <PageHeader title="Empaque" />
      {rows.length === 0 ? (
        <EmptyState icon="packing" title="No hay pedidos esperando empaque">
          Cuando alguien termine un picking, el pedido aparece acá.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th className="hidden text-right sm:table-cell">Preparadas</th>
                <th className="hidden text-right sm:table-cell">Faltantes</th>
                <th>Cajas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, customer, picked, packed, order }, i) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/empaque/${p.id}`} className="link doc-number" {...(i === 0 ? hotkey("primary", `Empacar ${p.number}`) : {})}>
                      {p.number}
                    </Link>{" "}
                    <CommentCount n={notes.get(p.id)} />
                  </td>
                  <td>
                    <span className="font-medium">{customer}</span>
                    <span className="block text-muted sm:hidden">
                      {plural(picked, "unidad preparada", "unidades preparadas")}
                      {picked < order && ` · ${order - picked} faltantes`}
                    </span>
                  </td>
                  <td className="hidden text-right font-semibold sm:table-cell">{picked}</td>
                  <td className={`hidden text-right sm:table-cell ${picked < order ? "font-semibold text-danger" : "text-muted"}`}>{picked < order ? order - picked : "—"}</td>
                  <td>
                    {packed > 0 ? (
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
