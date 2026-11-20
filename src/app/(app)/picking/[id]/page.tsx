import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ActionButton, ScanForm } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { Progress, Notice, PageHeader, Badge, ShelfMark } from "@/components/ui";
import { customers, orderLines, orders, products, pickTasks, locations } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { confirm, shortage, take } from "../actions";
import { hotkey } from "@/lib/hotkeys";
import { articleName } from "@/lib/article";

export default async function PickingOrder({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company } = await requireSession();
  const [row] = await db.select({ p: orders, customer: customers.name }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(and(eq(orders.id, id), eq(orders.companyId, company.id)));
  if (!row) notFound();
  const { p, customer } = row;
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));
  const tasks = await db
    .select({ t: pickTasks, title: products.title, code: products.barcode, location: locations.code })
    .from(pickTasks)
    .innerJoin(products, eq(products.id, pickTasks.productId))
    .leftJoin(locations, eq(locations.id, pickTasks.locationId))
    .where(eq(pickTasks.orderId, id))
    .orderBy(asc(locations.code), asc(products.title));

  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const picked = lines.reduce((s, l) => s + l.picked, 0);
  const pending = tasks.filter((x) => x.t.status === "pending");
  const shortages = tasks.filter((x) => x.t.status === "short" && x.t.quantity - x.t.picked > 0);
  const doneTasks = tasks.filter((x) => x.t.picked > 0);
  const nextStop = pending[0];

  return (
    <>
      <PageHeader title={`Pedido ${p.number}`} subtitle={customer} back={{ href: "/picking", text: "Picking" }}>
        {p.saleMode === "consignment" && <Badge>Consignación</Badge>}
      </PageHeader>

      {p.status === "pending" ? (
        <div className="max-w-md space-y-4 border-y border-line py-5 lg:py-4">
          <p>
            Este pedido tiene <strong>{total} unidades</strong> de {lines.length} artículos y todavía no lo tomó nadie.
          </p>
          <ActionButton action={take} hiddenFields={{ id }} className="btn w-full" showOk={false} hotkey="primary">
            Preparar este pedido
          </ActionButton>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-3 lg:sticky lg:top-30">
            <Progress done={picked} total={total} unit="unidades" />

            {nextStop ? (
              <>
                <div className="rounded-control bg-accent p-5 lg:p-4 text-on-accent">
                  <p className="mb-2.5 text-sm font-semibold opacity-85">Próxima parada · quedan {pending.length}</p>
                  <ShelfMark code={nextStop.location} size="xl" onAccent />
                  <p className="mt-4 text-lg lg:text-base leading-snug font-semibold">{articleName(nextStop.title)}</p>
                  <p className="font-mono text-sm font-bold opacity-85">{nextStop.code}</p>
                  <p className="mt-3 text-base">
                    Toma <span className="text-3xl lg:text-2xl font-bold">{nextStop.t.quantity - nextStop.t.picked}</span>
                  </p>
                </div>
                <ScanForm
                  action={confirm}
                  context="picking"
                  hiddenFields={{ taskId: nextStop.t.id }}
                  fields={[
                    { name: "location", label: "Ubicación", help: "Escanea la etiqueta" },
                    { name: "product", label: "Artículo" },
                  ]}
                  quantity={nextStop.t.quantity - nextStop.t.picked}
                  button="Confirmar"
                />
                <ActionButton action={shortage} hotkey="secondary" hiddenFields={{ taskId: nextStop.t.id }} className="btn-soft w-full" confirm={`¿Seguro que en ${nextStop.location} no ${nextStop.t.quantity - nextStop.t.picked === 1 ? "está la unidad que falta" : `están las ${nextStop.t.quantity - nextStop.t.picked} unidades que faltan`}? miDepo buscará el artículo en otra ubicación.`}>
                  No está en la ubicación
                </ActionButton>
              </>
            ) : p.status === "picked" ? (
              <Notice tone="ok">
                <p className="mb-3 text-base">Picking terminado. {shortages.length > 0 ? "Sale con faltantes." : "Está completo."}</p>
                <Link href={`/empaque/${id}`} className="btn w-full" {...hotkey("primary")}>
                  Ir a empacar
                </Link>
              </Notice>
            ) : (
              <Notice tone="ok">Este pedido ya pasó por empaque.</Notice>
            )}
          </div>

          <div className="min-w-0 space-y-7 lg:space-y-5">
            {shortages.length > 0 && (
              <section>
                <h2 className="section-title text-danger">Faltantes</h2>
                <ul className="ruled-list framed">
                  {shortages.map(({ t, title, location }) => (
                    <li key={t.id} className="row justify-between">
                      <span>
                        <span className="block font-medium">{articleName(title)}</span>
                        <span className="block text-sm text-muted">{location ? `No estaba en ${location}` : "Sin stock en ninguna ubicación"}</span>
                      </span>
                      <Badge tone="danger">Faltan {t.quantity - t.picked}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {pending.length > 1 && (
              <section>
                <h2 className="section-title">Próximas paradas</h2>
                <ul className="ruled-list framed">
                  {pending.slice(1).map(({ t, title, location }) => (
                    <li key={t.id} className="row">
                      <ShelfMark code={location} />
                      <span className="min-w-0 flex-1 truncate">{articleName(title)}</span>
                      <span className="font-semibold">× {t.quantity - t.picked}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {doneTasks.length > 0 && (
              <section>
                <h2 className="section-title">Tomado</h2>
                <ul className="ruled-list framed">
                  {doneTasks.map(({ t, title, location }) => (
                    <li key={t.id} className="row text-muted">
                      <ShelfMark code={location} />
                      <span className="min-w-0 flex-1 truncate">{articleName(title)}</span>
                      <span className="flex items-center gap-1 font-semibold text-ok">
                        <Icon name="ok" className="size-4" /> {t.picked}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
