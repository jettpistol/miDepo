import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ActionButton, ScanForm } from "@/components/ScanForm";
import { Progress, Notice, PageHeader, Badge, ShelfMark, plural } from "@/components/ui";
import { customers, orderLines, orders, pickBatches, pickTasks, products, locations, users } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { batchNumber } from "@/lib/flows/picking";
import { articleName } from "@/lib/article";
import { hotkey } from "@/lib/hotkeys";
import { confirmBatch, shortageBatch } from "../../actions";

export const metadata = { title: "Lote de picking" };

type Share = { order: string; tray: number | null; quantity: number };
type Stop = { locationId: number; productId: number; location: string; title: string; code: string; quantity: number; shares: Share[] };

export default async function PickingBatch({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company } = await requireSession();
  const [row] = await db
    .select({ b: pickBatches, takenBy: users.name })
    .from(pickBatches)
    .innerJoin(users, eq(users.id, pickBatches.takenBy))
    .where(and(eq(pickBatches.id, id), eq(pickBatches.companyId, company.id)));
  if (!row) notFound();
  const { b } = row;
  const trays = b.sorting === "trays";

  const batchOrders = await db
    .select({ o: orders, customer: customers.name })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(eq(orders.batchId, id))
    .orderBy(asc(orders.date), asc(orders.id));
  const lines = await db.select({ quantity: orderLines.quantity, picked: orderLines.picked }).from(orderLines).innerJoin(orders, eq(orders.id, orderLines.orderId)).where(eq(orders.batchId, id));
  const tasks = await db
    .select({ t: pickTasks, order: orders.number, tray: orders.tray, title: products.title, code: products.internalCode, location: locations.code })
    .from(pickTasks)
    .innerJoin(orders, eq(orders.id, pickTasks.orderId))
    .innerJoin(products, eq(products.id, pickTasks.productId))
    .leftJoin(locations, eq(locations.id, pickTasks.locationId))
    .where(eq(orders.batchId, id))
    .orderBy(asc(locations.code), asc(products.title), asc(orders.date), asc(orders.id));

  // One stop per shelf and title, whatever the number of orders that want it.
  const stops: Stop[] = [];
  for (const x of tasks) {
    if (x.t.status !== "pending" || x.t.locationId == null) continue;
    const left = x.t.quantity - x.t.picked;
    let s = stops.find((y) => y.locationId === x.t.locationId && y.productId === x.t.productId);
    if (!s) stops.push((s = { locationId: x.t.locationId, productId: x.t.productId, location: x.location!, title: x.title, code: x.code, quantity: 0, shares: [] }));
    s.quantity += left;
    const same = s.shares.find((y) => y.order === x.order);
    if (same) same.quantity += left;
    else s.shares.push({ order: x.order, tray: x.tray, quantity: left });
  }
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const picked = lines.reduce((s, l) => s + l.picked, 0);
  const shortages = tasks.filter((x) => x.t.status === "short" && x.t.quantity - x.t.picked > 0);
  const next = stops[0];

  return (
    <>
      <PageHeader title={`Lote ${batchNumber(b.number)}`} subtitle={`${plural(batchOrders.length, "pedido", "pedidos")} · ${row.takenBy}`} back={{ href: "/picking", text: "Picking" }}>
        <Badge>{trays ? "Por bandeja" : "Se separa en empaque"}</Badge>
      </PageHeader>

      <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-3 lg:sticky lg:top-30">
          <Progress done={picked} total={total} unit="unidades" />
          {next ? (
            <>
              <div className="rounded-control bg-accent p-5 lg:p-4 text-on-accent">
                <p className="mb-2.5 text-sm font-semibold opacity-85">Próxima parada · quedan {stops.length}</p>
                <ShelfMark code={next.location} size="xl" onAccent />
                <p className="mt-4 text-lg lg:text-base leading-snug font-semibold">{articleName(next.title)}</p>
                <p className="font-mono text-sm font-bold opacity-85">{next.code}</p>
                <p className="mt-3 text-base">
                  Toma <span className="text-3xl lg:text-2xl font-bold">{next.quantity}</span>
                  {next.shares.length > 1 && <span className="opacity-85"> para {next.shares.length} pedidos</span>}
                </p>
                {trays && (
                  <ul className="mt-3 space-y-1 border-t border-on-accent/25 pt-3 text-sm">
                    {next.shares.map((s) => (
                      <li key={s.order} className="flex justify-between gap-3">
                        <span>
                          <strong>Bandeja {s.tray}</strong> <span className="opacity-85">· {s.order}</span>
                        </span>
                        <strong>{s.quantity}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ScanForm
                action={confirmBatch}
                context="batch-picking"
                hiddenFields={{ batchId: id, locationId: next.locationId, productId: next.productId }}
                fields={[
                  { name: "location", label: "Ubicación", help: "Escanea la etiqueta" },
                  { name: "product", label: "Artículo" },
                ]}
                quantity={next.quantity}
                button="Confirmar"
              />
              <ActionButton action={shortageBatch} hotkey="secondary" hiddenFields={{ batchId: id, locationId: next.locationId, productId: next.productId }} className="btn-soft w-full" confirm={`¿Seguro que en ${next.location} no ${next.quantity === 1 ? "está la unidad que falta" : `están las ${next.quantity} unidades que faltan`}? miDepo buscará el artículo en otra ubicación.`}>
                No está en la ubicación
              </ActionButton>
            </>
          ) : (
            <Notice tone="ok">
              <p className="mb-3 text-base">
                Lote terminado. {trays ? "Cada pedido está en su bandeja." : "Todo está en PREPARACIÓN; en empaque se separa por pedido."} {shortages.length > 0 && "Hay faltantes."}
              </p>
              <Link href="/empaque" className="btn w-full" {...hotkey("primary")}>
                Ir a empaque
              </Link>
            </Notice>
          )}
        </div>

        <div className="min-w-0 space-y-7 lg:space-y-5">
          {shortages.length > 0 && (
            <section>
              <h2 className="section-title text-danger">Faltantes</h2>
              <ul className="ruled-list framed">
                {shortages.map(({ t, title, location, order }) => (
                  <li key={t.id} className="row justify-between">
                    <span className="min-w-0">
                      <span className="block font-medium">{articleName(title)}</span>
                      <span className="block text-sm text-muted">
                        {order} · {location ? `No estaba en ${location}` : "Sin stock en ninguna ubicación"}
                      </span>
                    </span>
                    <Badge tone="danger">Faltan {t.quantity - t.picked}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {stops.length > 1 && (
            <section>
              <h2 className="section-title">
                Próximas paradas <small>{stops.length - 1}</small>
              </h2>
              <ul className="ruled-list framed">
                {stops.slice(1).map((s) => (
                  <li key={`${s.locationId}-${s.productId}`} className="row">
                    <ShelfMark code={s.location} />
                    <span className="min-w-0 flex-1 truncate">{articleName(s.title)}</span>
                    {s.shares.length > 1 && <span className="hidden text-sm text-muted sm:inline">{s.shares.length} pedidos</span>}
                    <span className="font-semibold">× {s.quantity}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2 className="section-title">
              {trays ? "Bandejas" : "Pedidos"} <small>{batchOrders.length}</small>
            </h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {trays && <th className="w-0">Bandeja</th>}
                    <th>Pedido</th>
                    <th className="hidden sm:table-cell">Cliente</th>
                    <th className="text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {batchOrders.map(({ o, customer }) => (
                    <tr key={o.id}>
                      {trays && <td className="text-center text-base font-bold tabular-nums">{o.tray}</td>}
                      <td>
                        <span className="doc-number">{o.number}</span>
                        <span className="block truncate text-sm text-muted sm:hidden">{customer}</span>
                      </td>
                      <td className="hidden sm:table-cell">{customer}</td>
                      <td className="text-right">{o.status === "in_picking" ? <Badge>En preparación</Badge> : o.status === "picked" ? <Badge tone="accent">Listo para empacar</Badge> : <Badge tone="ok">Empacado</Badge>}</td>
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
