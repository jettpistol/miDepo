import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ActionButton, ScanForm, ActionForm } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { Progress, Notice, PageHeader, Badge } from "@/components/ui";
import { boxItems, boxes, customers, orderLines, orders, products } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { close, scan, finish, empty } from "../actions";

const kg = (g: number) => (g / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 });

export default async function PackingOrder({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company } = await requireSession();
  const [row] = await db.select({ p: orders, customer: customers.name }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(and(eq(orders.id, id), eq(orders.companyId, company.id)));
  if (!row) notFound();
  const { p, customer } = row;
  const lines = await db.select({ l: orderLines, title: products.title }).from(orderLines).innerJoin(products, eq(products.id, orderLines.productId)).where(eq(orderLines.orderId, id)).orderBy(asc(products.title));
  const ofOrder = await db.select().from(boxes).where(eq(boxes.orderId, id)).orderBy(asc(boxes.number));
  const items = ofOrder.length
    ? await db.select({ i: boxItems, title: products.title, weight: products.weightGrams }).from(boxItems).innerJoin(products, eq(products.id, boxItems.productId)).where(inArray(boxItems.boxId, ofOrder.map((k) => k.id))).orderBy(asc(products.title))
    : [];
  const picked = lines.reduce((s, x) => s + x.l.picked, 0);
  const packed = lines.reduce((s, x) => s + x.l.packed, 0);
  const open = ofOrder.find((k) => k.status === "open");
  const ready = p.status === "packed" || p.status === "shipped";
  const editable = p.status === "picked";

  return (
    <>
      <PageHeader title={`Empaque ${p.number}`} subtitle={customer} back={{ href: "/empaque", text: "Empaque" }}>
        {ofOrder.some((k) => k.status === "closed") && (
          <>
            <Link href={`/imprimir/cajas/${id}`} target="_blank" className="btn-soft">
              <Icon name="print" /> Etiquetas
            </Link>
            <Link href={`/imprimir/lista/${id}`} target="_blank" className="btn-soft">
              <Icon name="print" /> Lista de empaque
            </Link>
          </>
        )}
      </PageHeader>

      {!editable && !ready && (
        <Notice tone="warn">
          Este pedido todavía está en picking.{" "}
          <Link href={`/picking/${id}`} className="font-semibold underline underline-offset-[3px]">
            Ver el recorrido
          </Link>
        </Notice>
      )}
      {ready && <Notice tone="ok">Pedido empacado en {ofOrder.length} {ofOrder.length === 1 ? "caja" : "cajas"}. {p.status === "shipped" ? "Ya está documentado en Fierro y salió del depósito." : "Imprime las etiquetas y la lista de empaque; la oficina lo documenta en Fierro."}</Notice>}

      <div className={`grid gap-5 lg:items-start lg:gap-8 ${editable ? "lg:grid-cols-[minmax(0,22rem)_1fr]" : ""} ${ready || !editable ? "mt-6" : ""}`}>
        {editable && (
          <div className="space-y-3 lg:sticky lg:top-30">
            <Progress done={packed} total={picked} unit="en cajas" />
            {packed < picked && <ScanForm action={scan} context="packing" hiddenFields={{ id }} fields={[{ name: "product", label: open ? `Libro para la caja ${open.number}` : "Libro (abre una caja nueva)" }]} quantity={1} button="Poner en la caja" />}
            {open && items.some((x) => x.i.boxId === open.id) && (
              <div className="panel p-4 lg:p-3">
                <h2 className="section-title mb-3">Cerrar la caja {open.number}</h2>
                <ActionForm action={close} button="Cerrar caja" className="space-y-3">
                  <input type="hidden" name="boxId" value={open.id} />
                  <div>
                    <label htmlFor="kg" className="field-label">
                      Peso real en kg <span className="font-normal text-muted">(opcional)</span>
                    </label>
                    <input id="kg" name="kg" inputMode="decimal" className="field" placeholder={`Estimado: ${kg(items.filter((x) => x.i.boxId === open.id).reduce((s, x) => s + x.i.quantity * x.weight, 0))} kg`} />
                  </div>
                </ActionForm>
              </div>
            )}
            {packed === picked && !open && (
              <ActionButton action={finish} hiddenFields={{ id }} className="btn w-full">
                Terminar pedido
              </ActionButton>
            )}
          </div>
        )}

        <div className="min-w-0 space-y-7 lg:space-y-5">
          {ofOrder.map((k) => {
            const own = items.filter((x) => x.i.boxId === k.id);
            return (
              <section key={k.id}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                  <h2 className="section-title mb-0">Caja {k.number}</h2>
                  <span className="flex flex-wrap items-center justify-end gap-3">
                    {k.status === "closed" ? <Badge tone="ok">Cerrada · {kg(k.weightGrams ?? 0)} kg</Badge> : <Badge tone="accent">Abierta</Badge>}
                    {k.status === "open" && editable && (
                      <ActionButton action={empty} hiddenFields={{ boxId: k.id }} className="btn-sm border-danger/50 text-danger hover:border-danger hover:bg-danger-soft hover:text-danger" confirm={`¿Vaciar la caja ${k.number}? Vas a tener que escanear de nuevo lo que tenía.`} showOk={false}>
                        Vaciar
                      </ActionButton>
                    )}
                  </span>
                </div>
                <ul className="ruled-list framed">
                  {own.map((x) => (
                    <li key={x.i.productId} className="row justify-between">
                      <span className="min-w-0">{x.title}</span>
                      <span className="font-semibold whitespace-nowrap">× {x.i.quantity}</span>
                    </li>
                  ))}
                  {own.length === 0 && <li className="row text-muted">Vacía</li>}
                </ul>
              </section>
            );
          })}

          <section>
            <h2 className="section-title">
              Títulos del pedido <small>{lines.length}</small>
            </h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th className="hidden text-right sm:table-cell">Pedido</th>
                    <th className="text-right">Preparado</th>
                    <th className="text-right">En cajas</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ l, title }) => (
                    <tr key={l.id}>
                      <td>
                        <span className="font-medium">{title}</span>
                        <span className="block text-muted sm:hidden">Pedido: {l.quantity}</span>
                      </td>
                      <td className="hidden text-right sm:table-cell">{l.quantity}</td>
                      <td className={`text-right ${l.picked < l.quantity ? "font-semibold text-danger" : ""}`}>{l.picked}</td>
                      <td className={`text-right font-semibold ${l.packed === l.picked && l.picked > 0 ? "text-ok" : ""}`}>{l.packed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
