import Link from "next/link";
import { ScanForm } from "@/components/ScanForm";
import { Badge, EmptyRow, PageHeader } from "@/components/ui";
import { toDispatch } from "@/lib/flows/dispatch";
import { requireSession } from "@/lib/session";
import { load } from "./actions";

export const metadata = { title: "Despacho" };

export default async function Dispatch() {
  const { db, company } = await requireSession();
  const rows = await toDispatch(db, company.id);
  return (
    <>
      <PageHeader title="Despacho" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-30">
          <ScanForm action={load} context="dispatch" fields={[{ name: "box", label: "Caja", help: "Etiqueta de la caja" }]} button="Cargar" />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th className="hidden sm:table-cell">Cliente</th>
                <th>Transporte</th>
                <th className="hidden md:table-cell">Remito</th>
                <th className="text-right">Cajas</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow columns={5} title="Sin pedidos por despachar" />}
              {rows.map(({ o, customer, city, carrier, boxes, loaded }) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/despacho/${o.id}`} className="link doc-number">
                      {o.number}
                    </Link>
                    {o.urgent && (
                      <>
                        {" "}
                        <Badge tone="danger">Urgente</Badge>
                      </>
                    )}
                    <span className="block text-muted sm:hidden">{customer}</span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <span className="font-medium">{customer}</span>
                    <span className="block text-muted">{city}</span>
                  </td>
                  <td>{carrier ?? <Badge tone="warn">Sin transporte</Badge>}</td>
                  <td className="hidden font-mono text-xs md:table-cell">{o.remitoNumber ?? <span className="text-muted">—</span>}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {loaded > 0 ? (
                      <Badge tone="accent">
                        {loaded} de {boxes}
                      </Badge>
                    ) : (
                      boxes
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
