import Link from "next/link";
import { Badge, EmptyRow, plural, shortDate } from "@/components/ui";
import type { ReturnRow } from "@/lib/lists";
import { hotkey } from "@/lib/hotkeys";
import { AssigneeCell, type Assignees } from "@/components/Assignee";

/** With `assignees`, an "Asignado" column (for returns still in progress). */
export function ReturnsTable({ rows, empty, showCustomer = true, assignees }: { rows: ReturnRow[]; empty?: { title: string; text?: string }; showCustomer?: boolean; assignees?: Assignees }) {
  const columns = 4 + (showCustomer ? 1 : 0) + (assignees ? 1 : 0);
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Devolución</th>
            {showCustomer && <th>Cliente</th>}
            {assignees && <th className="hidden sm:table-cell">Asignado</th>}
            <th className="hidden text-right sm:table-cell">Unidades</th>
            <th className="hidden sm:table-cell">Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty && (
            <EmptyRow columns={columns} title={empty.title}>
              {empty.text}
            </EmptyRow>
          )}
          {rows.map(({ d, customer, customerId, units }, i) => (
            <tr key={d.id}>
              <td>
                <Link href={`/devoluciones/${d.id}`} className="link doc-number" {...(i === 0 && d.status === "in_progress" ? hotkey("primary", `Abrir ${d.number}`) : {})}>
                  {d.number}
                </Link>
              </td>
              {showCustomer && (
                <td>
                  <Link href={`/clientes/${customerId}`} className="font-medium hover:text-accent-text hover:underline">
                    {customer}
                  </Link>
                  <span className="block text-muted sm:hidden">
                    {plural(units, "unidad", "unidades")} · {shortDate(d.date)}
                  </span>
                </td>
              )}
              {assignees && (
                <td className="hidden sm:table-cell">
                  <AssigneeCell a={assignees} kind="return" id={d.id} value={d.assignedTo} open={d.status === "in_progress"} />
                </td>
              )}
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
