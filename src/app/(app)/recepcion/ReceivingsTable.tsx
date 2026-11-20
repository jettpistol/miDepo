import Link from "next/link";
import { Badge, EmptyRow, plural, shortDate } from "@/components/ui";
import type { ReceivingRow } from "@/lib/lists";

const STATE = { pending: <Badge>Sin empezar</Badge>, in_progress: <Badge tone="accent">En curso</Badge>, closed: <Badge tone="ok">Cerrada</Badge> } as const;

/** A list of receivings: number, supplier (unless on the supplier's own page), units, date, state. */
export function ReceivingsTable({ rows, showSupplier = true, empty }: { rows: ReceivingRow[]; showSupplier?: boolean; empty: { title: string; text?: string } }) {
  const columns = showSupplier ? 6 : 5;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Recepción</th>
            {showSupplier && <th>Proveedor</th>}
            <th className="hidden text-right sm:table-cell">Artículos</th>
            <th className="hidden text-right sm:table-cell">Recibidas</th>
            <th className="hidden md:table-cell">Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <EmptyRow columns={columns} title={empty.title}>
              {empty.text}
            </EmptyRow>
          )}
          {rows.map(({ r, supplier, supplierId, titles, received }) => (
            <tr key={r.id}>
              <td>
                <Link href={`/recepcion/${r.id}`} className="link doc-number">
                  {r.number}
                </Link>
                {!showSupplier && <span className="block text-muted sm:hidden">{plural(received, "unidad", "unidades")} · {shortDate(r.date)}</span>}
              </td>
              {showSupplier && (
                <td>
                  <Link href={`/proveedores/${supplierId}`} className="font-medium hover:text-accent-text hover:underline">
                    {supplier}
                  </Link>
                  <span className="block text-muted md:hidden">
                    <span className="sm:hidden">{plural(received, "unidad", "unidades")} · </span>
                    {shortDate(r.date)}
                  </span>
                </td>
              )}
              <td className="hidden text-right tabular-nums sm:table-cell">{titles}</td>
              <td className="hidden text-right font-semibold tabular-nums sm:table-cell">{received}</td>
              <td className="hidden whitespace-nowrap text-muted md:table-cell">{shortDate(r.date)}</td>
              <td className="w-px">
                {STATE[r.status]}
                {r.status === "closed" && !r.sentToFierro && <span className="mt-0.5 block text-xs whitespace-nowrap text-muted">Sin cargar en Fierro</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
