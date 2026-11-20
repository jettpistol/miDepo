import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ActionButton, ScanForm } from "@/components/ScanForm";
import { Progress, Notice, PageHeader, SALE_MODE } from "@/components/ui";
import { customers, orderLines, orders, products, users } from "@/db/schema";
import { articleName } from "@/lib/article";
import { blockedCheck } from "@/lib/flows/control";
import { fierroWarning } from "@/lib/orderState";
import { hotkey } from "@/lib/hotkeys";
import { requireSession } from "@/lib/session";
import { Urgency } from "@/components/Urgency";
import { finish, missing, restart, scan } from "../actions";

const picker = alias(users, "picker");
const controller = alias(users, "controller");

export default async function ControlOrder({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const session = await requireSession();
  const { db, company, user } = session;
  const [row] = await db
    .select({ p: orders, customer: customers.name, pickedBy: picker.name, controlledBy: controller.name })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(picker, eq(picker.id, orders.takenBy))
    .leftJoin(controller, eq(controller.id, orders.controlledBy))
    .where(and(eq(orders.id, id), eq(orders.companyId, company.id)));
  if (!row) notFound();
  const { p, customer, pickedBy, controlledBy } = row;
  const lines = await db.select({ l: orderLines, title: products.title }).from(orderLines).innerJoin(products, eq(products.id, orderLines.productId)).where(eq(orderLines.orderId, id)).orderBy(asc(products.title));
  const picked = lines.reduce((s, x) => s + x.l.picked, 0);
  const checked = lines.reduce((s, x) => s + x.l.checked, 0);
  const waiting = p.status === "to_control";
  const blocked = waiting ? blockedCheck(company, p, user.id, "controlar") : null;
  const editable = waiting && !blocked;

  return (
    <>
      <PageHeader title={`Control ${p.number}`} subtitle={`${customer} · ${SALE_MODE[p.saleMode]} · preparó ${pickedBy ?? "—"}`} back={{ href: "/control", text: "Control" }}>
        <Urgency session={session} order={p} />
      </PageHeader>

      {(p.status === "pending" || p.status === "in_picking") && (
        <Notice tone="warn">
          Este pedido todavía está en picking.{" "}
          <Link href={`/picking/${id}`} className="font-semibold underline underline-offset-[3px]">
            Ver el recorrido
          </Link>
        </Notice>
      )}
      {waiting && fierroWarning(p) && <Notice tone="warn">{fierroWarning(p)}</Notice>}
      {blocked && <Notice tone="warn">{blocked}</Notice>}
      {!waiting && p.status !== "pending" && p.status !== "in_picking" && (
        <Notice tone="ok">
          {controlledBy ? `Controlado por ${controlledBy}.` : "Este pedido no pasó por control."}{" "}
          {p.status === "picked" && (
            <Link href={`/empaque/${id}`} className="font-semibold underline underline-offset-[3px]" {...hotkey("primary", "Ir a empacar")}>
              Ir a empacar
            </Link>
          )}
        </Notice>
      )}

      <div className={`grid gap-5 lg:items-start lg:gap-8 ${editable ? "lg:grid-cols-[minmax(0,22rem)_1fr]" : "mt-6"}`}>
        {editable && (
          <div className="space-y-3 lg:sticky lg:top-30">
            <Progress done={checked} total={picked} unit="controladas" />
            {checked < picked && <ScanForm action={scan} context="control" hiddenFields={{ id }} fields={[{ name: "product", label: "Artículo del carro" }]} quantity={1} button="Contar" />}
            {checked === picked && (
              <ActionButton action={finish} hiddenFields={{ id }} className="btn w-full" hotkey="finish">
                Terminar control
              </ActionButton>
            )}
            {checked > 0 && (
              <ActionButton action={restart} hiddenFields={{ id }} className="btn-soft w-full" confirm="¿Empezar el control de nuevo? Se borra lo contado hasta ahora." showOk={false}>
                Empezar de nuevo
              </ActionButton>
            )}
          </div>
        )}

        <section className="min-w-0">
          <h2 className="section-title">
            Artículos del pedido <small>{lines.length}</small>
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th className="text-right">Preparado</th>
                  <th className="text-right">Controlado</th>
                  {editable && <th className="w-0" />}
                </tr>
              </thead>
              <tbody>
                {lines.map(({ l, title }) => {
                  const left = l.picked - l.checked;
                  return (
                    <tr key={l.id}>
                      <td className="font-medium">{articleName(title)}</td>
                      <td className="text-right">{l.picked}</td>
                      <td className={`text-right font-semibold ${left === 0 && l.picked > 0 ? "text-ok" : ""}`}>{l.checked}</td>
                      {editable && (
                        <td className="text-right whitespace-nowrap">
                          {left > 0 && (
                            <ActionButton action={missing} hiddenFields={{ id, lineId: l.id }} className="btn-sm" confirm={`¿Seguro que en el carro no hay más de "${articleName(title)}"? ${left === 1 ? "La unidad que falta pasa" : `Las ${left} unidades que faltan pasan`} a Faltantes y el pedido sale sin ${left === 1 ? "ella" : "ellas"}.`}>
                              No está
                            </ActionButton>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
