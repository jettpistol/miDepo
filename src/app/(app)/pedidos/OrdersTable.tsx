import Link from "next/link";
import { CommentCount } from "@/components/comments/Comments";
import { Badge, EmptyRow, plural, shortDate, type Tone, Condition, SALE_MODE } from "@/components/ui";
import type { orders, OrderStatus } from "@/db/schema";
import { orderScreen } from "@/lib/lists";

export const ORDER_STATE: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: "Por preparar", tone: "neutral" },
  in_picking: { label: "En picking", tone: "accent" },
  to_control: { label: "Por controlar", tone: "warn" },
  picked: { label: "Por empacar", tone: "warn" },
  packed: { label: "Empacado", tone: "accent" },
  shipped: { label: "Despachado", tone: "ok" },
  cancelled: { label: "Anulado", tone: "neutral" },
};

type Row = { o: typeof orders.$inferSelect; customer: string; units: number };

/** Orders of any state. Each opens where it is worked on: picking, control, or packing. */
export function OrdersTable({ rows, showCustomer = true, empty, comments }: { rows: Row[]; showCustomer?: boolean; empty: { title: string; text?: string }; comments?: Map<number, number> }) {
  const columns = showCustomer ? 6 : 5;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Pedido</th>
            {showCustomer && <th>Cliente</th>}
            <th className="hidden sm:table-cell">Condición</th>
            <th className="hidden text-right sm:table-cell">Unidades</th>
            <th className="hidden sm:table-cell">Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <EmptyRow columns={columns} title={empty.title}>
              {empty.text}
            </EmptyRow>
          )}
          {rows.map(({ o, customer, units }) => (
            // The order number's link covers the whole row; the customer link sits above it.
            <tr key={o.id} className="relative cursor-pointer">
              <td>
                <Link href={`/${orderScreen(o.status)}/${o.id}`} className="link doc-number after:absolute after:inset-0">
                  {o.number}
                </Link>{" "}
                <CommentCount n={comments?.get(o.id)} />
                {!showCustomer && <span className="block text-muted sm:hidden">{plural(units, "unidad", "unidades")} · {SALE_MODE[o.saleMode]} · {shortDate(o.date)}</span>}
              </td>
              {showCustomer && (
                <td>
                  <Link href={`/clientes/${o.customerId}`} className="relative z-10 font-medium hover:text-accent-text hover:underline">
                    {customer}
                  </Link>
                  <span className="block text-muted sm:hidden">
                    {plural(units, "unidad", "unidades")} · {SALE_MODE[o.saleMode]} · {shortDate(o.date)}
                  </span>
                </td>
              )}
              <td className="hidden sm:table-cell">
                <Condition mode={o.saleMode} href={`/${orderScreen(o.status)}/${o.id}`} />
              </td>
              <td className="hidden text-right font-semibold tabular-nums sm:table-cell">{units}</td>
              <td className="hidden whitespace-nowrap text-muted sm:table-cell">{shortDate(o.date)}</td>
              <td className="w-px">
                <span className="flex gap-1">
                  {o.urgent && ["pending", "in_picking", "to_control", "picked"].includes(o.status) && <Badge tone="danger">Urgente</Badge>}
                  <Badge tone={ORDER_STATE[o.status].tone}>{ORDER_STATE[o.status].label}</Badge>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
