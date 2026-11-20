import Link from "next/link";
import { Comments, CommentsLink } from "@/components/comments/Comments";
import { commentCounts } from "@/lib/flows/comments";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ActionButton, ScanForm, ActionForm } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { Progress, Notice, PageHeader, Badge, SALE_MODE } from "@/components/ui";
import { boxItems, boxes, customers, orderLines, orders, products, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { SameCheck } from "@/components/SameCheck";
import { blockedCheck } from "@/lib/flows/control";
import { requireSession } from "@/lib/session";
import { fierroWarning } from "@/lib/orderState";
import { Assignee } from "@/components/Assignee";
import { Urgency } from "@/components/Urgency";
import { close, scan, finish, empty, takeOut, reopen, reopenOrder } from "../actions";
import { articleName } from "@/lib/article";

const kg = (g: number) => (g / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 });

export default async function PackingOrder({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const session = await requireSession();
  const { db, company, user } = session;
  const [picker, allower] = [alias(users, "picker"), alias(users, "allower")];
  const [row] = await db
    .select({ p: orders, customer: customers.name, pickedBy: picker.name, allowedBy: allower.name })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(picker, eq(picker.id, orders.takenBy))
    .leftJoin(allower, eq(allower.id, orders.sameCheckAllowedBy))
    .where(and(eq(orders.id, id), eq(orders.companyId, company.id)));
  if (!row) notFound();
  const commentCount = (await commentCounts(db, company.id, "order", [id])).get(id);
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
  // When the order skipped Control, packing is the check.
  const blocked = p.status === "picked" && p.controlledBy == null ? blockedCheck(company, p, user.id, "empacar") : null;
  const editable = p.status === "picked" && !blocked;
  const warning = p.status === "shipped" ? null : fierroWarning(p);

  return (
    <>
      <PageHeader title={p.number} subtitle={`${customer} · ${SALE_MODE[p.saleMode]}`} back={{ href: "/empaque", text: "Empaque" }} meta={<Assignee session={session} kind="order" id={p.id} value={p.assignedTo} open={p.status === "picked"} />}>
        <Urgency session={session} order={p} />
        {ofOrder.some((k) => k.status === "closed") && (
          <>
            <Link href={`/etiqueta/${id}`} target="_blank" className="btn-soft">
              <Icon name="print" /> Etiquetas
            </Link>
            <Link href={`/imprimir/lista/${id}`} target="_blank" className="btn-soft">
              <Icon name="print" /> Lista de empaque
            </Link>
          </>
        )}
        {commentCount ? <CommentsLink n={commentCount} /> : null}
      </PageHeader>

      {warning && <Notice tone="warn">{warning}</Notice>}
      {blocked && <Notice tone="warn">{blocked}</Notice>}
      {p.status === "picked" && p.controlledBy == null && <SameCheck session={session} order={p} picker={row.pickedBy} allowedBy={row.allowedBy} what="empaque" />}
      {p.status === "to_control" && (
        <Notice tone="warn">
          Este pedido todavía no pasó por control.{" "}
          <Link href={`/control/${id}`} className="font-semibold underline underline-offset-[3px]">
            Ir a control
          </Link>
        </Notice>
      )}
      {(p.status === "pending" || p.status === "in_picking") && (
        <Notice tone="warn">
          Este pedido todavía está en picking.{" "}
          <Link href={`/picking/${id}`} className="font-semibold underline underline-offset-[3px]">
            Ver el recorrido
          </Link>
        </Notice>
      )}
      {ready && (
        <Notice tone="ok">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Pedido empacado en {ofOrder.length} {ofOrder.length === 1 ? "caja" : "cajas"}. {p.status === "shipped" ? "Despachado." : "Pendiente en Fierro."}
            </span>
            {p.status === "packed" && (
              <ActionButton action={reopenOrder} hiddenFields={{ id }} className="btn-sm" showOk={false} confirm={`¿Reabrir el empaque de ${p.number}? Deja de estar listo para cargar en Fierro hasta que lo termines de nuevo.`}>
                Reabrir empaque
              </ActionButton>
            )}
          </span>
        </Notice>
      )}

      <div className={`grid gap-5 lg:items-start lg:gap-8 ${editable ? "lg:grid-cols-[minmax(0,22rem)_1fr]" : ""} ${!editable ? "mt-6" : ""}`}>
        {editable && (
          <div className="space-y-3 lg:sticky lg:top-30">
            <Progress done={packed} total={picked} unit="en cajas" />
            {packed < picked && <ScanForm action={scan} context="packing" hiddenFields={{ id }} fields={[{ name: "product", label: open ? `Artículo para la caja ${open.number}` : "Artículo (abre una caja nueva)" }]} quantity={1} button="Poner en la caja" />}
            {open && items.some((x) => x.i.boxId === open.id) && (
              <div className="panel p-4 lg:p-3">
                <h2 className="section-title mb-3">Cerrar la caja {open.number}</h2>
                <ActionForm action={close} button="Cerrar caja" className="space-y-3" hotkey="secondary">
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
              <ActionButton action={finish} hiddenFields={{ id }} className="btn w-full" hotkey="finish">
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
                    {k.status === "closed" && editable && (
                      <ActionButton action={reopen} hiddenFields={{ boxId: k.id }} className="btn-sm" showOk={false} reason={open ? `Cierra la caja ${open.number} antes de reabrir otra.` : undefined}>
                        Reabrir
                      </ActionButton>
                    )}
                    {k.status === "open" && editable && (
                      <ActionButton action={empty} hiddenFields={{ boxId: k.id }} className="btn-sm border-danger/50 text-danger hover:border-danger hover:bg-danger-soft hover:text-danger" confirm={`¿Vaciar la caja ${k.number}? Tendrás que escanear de nuevo lo que contenía.`} showOk={false}>
                        Vaciar
                      </ActionButton>
                    )}
                  </span>
                </div>
                <ul className="ruled-list framed">
                  {own.map((x) => (
                    <li key={x.i.productId} className="row justify-between">
                      <span className="min-w-0 flex-1">{articleName(x.title)}</span>
                      <span className="font-semibold whitespace-nowrap">× {x.i.quantity}</span>
                      {k.status === "open" && editable && (
                        <ActionButton action={takeOut} hiddenFields={{ boxId: k.id, productId: x.i.productId }} className="btn-sm" showOk={false}>
                          Sacar
                        </ActionButton>
                      )}
                    </li>
                  ))}
                  {own.length === 0 && <li className="row text-muted">Vacía</li>}
                </ul>
              </section>
            );
          })}

          <section>
            <h2 className="section-title">
              Artículos del pedido <small>{lines.length}</small>
            </h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th className="hidden text-right sm:table-cell">Pedido</th>
                    <th className="text-right">Preparado</th>
                    <th className="text-right">En cajas</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ l, title }) => (
                    <tr key={l.id}>
                      <td>
                        <span className="font-medium">{articleName(title)}</span>
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
      <div className="mt-8 lg:mt-6">
        <Comments db={db} companyId={company.id} userId={user.id} subjectType="order" subjectId={id} />
      </div>
    </>
  );
}
