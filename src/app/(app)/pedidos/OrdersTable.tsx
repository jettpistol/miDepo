import Link from "next/link";
import { Badge, EmptyRow, plural, shortDate, type Tone } from "@/components/ui";
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
export function OrdersTable({ rows, showCustomer = true, empty }: { rows: Row[]; showCustomer?: boolean; empty: { title: string; text?: string } }) {
  const columns = showCustomer ? 6 : 5;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Pedido</th>
            {showCustomer && <th>Cliente</th>}
            <th className="hidden md:table-cell">Venta</th>
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
            <tr key={o.id}>
              <td>
                <Link href={`/${orderScreen(o.status)}/${o.id}`} className="link doc-number">
                  {o.number}
                </Link>
                {!showCustomer && <span className="block text-muted sm:hidden">{plural(units, "unidad", "unidades")} · {shortDate(o.date)}</span>}
              </td>
              {showCustomer && (
                <td>
                  <Link href={`/clientes/${o.customerId}`} className="font-medium hover:text-accent-text hover:underline">
                    {customer}
                  </Link>
                  <span className="block text-muted sm:hidden">
                    {plural(units, "unidad", "unidades")} · {shortDate(o.date)}
                  </span>
                </td>
              )}
              <td className="hidden text-muted md:table-cell">{o.saleMode === "consignment" ? "Consignación" : "Firme"}</td>
              <td className="hidden text-right font-semibold tabular-nums sm:table-cell">{units}</td>
              <td className="hidden whitespace-nowrap text-muted sm:table-cell">{shortDate(o.date)}</td>
              <td className="w-px">
                <Badge tone={ORDER_STATE[o.status].tone}>{ORDER_STATE[o.status].label}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
