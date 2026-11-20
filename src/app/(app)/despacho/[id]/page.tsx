import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ActionButton, ActionForm } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { Badge, EmptyRow, Notice, PageHeader, shortDate } from "@/components/ui";
import { boxes, carriers, customers, orders, users } from "@/db/schema";
import { listCarriers } from "@/lib/flows/dispatch";
import { can, requireSession } from "@/lib/session";
import { CarrierSelect } from "../CarrierSelect";
import { shipping, unload } from "../actions";

export default async function DispatchOrder({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company, user } = await requireSession();
  const by = alias(users, "dispatched_by");
  const [row] = await db
    .select({ o: orders, customer: customers.name, city: customers.city, carrier: carriers.name, by: by.name })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(carriers, eq(carriers.id, orders.carrierId))
    .leftJoin(by, eq(by.id, orders.dispatchedBy))
    .where(and(eq(orders.id, id), eq(orders.companyId, company.id)));
  if (!row) notFound();
  const { o } = row;
  const loader = alias(users, "loaded_by");
  const bx = await db.select({ b: boxes, by: loader.name }).from(boxes).leftJoin(loader, eq(loader.id, boxes.loadedBy)).where(eq(boxes.orderId, id)).orderBy(asc(boxes.number));
  const options = (await listCarriers(db, company.id)).map((c) => ({ value: String(c.id), label: c.name }));
  const packed = o.status === "packed" || o.status === "shipped";
  const editable = packed && !o.dispatchedAt;

  return (
    <>
      <PageHeader title={`Despacho ${o.number}`} subtitle={`${row.customer} · ${row.city ?? ""}`} back={{ href: "/despacho", text: "Despacho" }}>
        {bx.length > 0 && (
          <>
            <Link href={`/etiqueta/${id}`} target="_blank" className="btn-soft">
              <Icon name="print" /> Etiquetas
            </Link>
          </>
        )}
      </PageHeader>

      {!packed && <Notice tone="warn">Todavía no está empacado.</Notice>}
      {o.dispatchedAt && (
        <Notice tone="ok">
          Despachado · {shortDate(o.dispatchedAt)} · {row.by}
        </Notice>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-8">
        <ActionForm action={shipping} button="Guardar" resetOnOk={false} reason={!packed ? "Todavía no está empacado." : o.dispatchedAt ? "Ya salió. Descarga una caja para cambiarlo." : undefined}>
          <input type="hidden" name="id" value={id} />
          <div>
            <label htmlFor="carrier" className="field-label">
              Transporte
            </label>
            <CarrierSelect options={options} canCreate={can(user.role, "supervisor")} value={o.carrierId ? String(o.carrierId) : undefined} />
          </div>
          <div>
            <label htmlFor="tracking" className="field-label">
              Seguimiento
            </label>
            <input id="tracking" name="tracking" defaultValue={o.trackingNumber ?? ""} maxLength={60} className="field font-mono" disabled={!editable} />
          </div>
          <div>
            <label htmlFor="remito" className="field-label">
              Remito
            </label>
            <input id="remito" name="remito" defaultValue={o.remitoNumber ?? ""} maxLength={60} placeholder="R 0001-00001234" className="field font-mono" disabled={!editable} />
          </div>
        </ActionForm>

        <section>
          <h2 className="section-title">
            Cajas <small>{bx.filter((x) => x.b.loadedAt).length} de {bx.length} cargadas</small>
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Caja</th>
                  <th className="hidden text-right sm:table-cell">Peso</th>
                  <th>Carga</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bx.length === 0 && <EmptyRow columns={4} title="Sin cajas" />}
                {bx.map(({ b, by: who }) => (
                  <tr key={b.id}>
                    <td className="doc-number">
                      {o.number}-C{b.number}
                    </td>
                    <td className="hidden text-right tabular-nums sm:table-cell">{b.weightGrams ? `${(b.weightGrams / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg` : "—"}</td>
                    <td>{b.loadedAt ? <span className="text-muted">{shortDate(b.loadedAt)} · {who}</span> : <Badge>Sin cargar</Badge>}</td>
                    <td className="w-px text-right">
                      {b.loadedAt && (
                        <ActionButton action={unload} hiddenFields={{ boxId: b.id }} className="btn-soft btn-sm" confirm={`¿Descargar la caja ${b.number}? El pedido deja de figurar como despachado.`}>
                          Descargar
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
