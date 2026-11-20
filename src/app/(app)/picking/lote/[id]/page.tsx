import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ActionButton, ScanForm } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { Progress, Notice, PageHeader, Badge, ShelfMark, plural, Condition, SALE_MODE } from "@/components/ui";
import { Cover } from "@/components/ProductCards";
import { orderScreen } from "@/lib/lists";
import { boxes, customers, orderLines, orders, pickBatches, pickTasks, products, locations, users } from "@/db/schema";
import { can, requireSession } from "@/lib/session";
import { batchNumber } from "@/lib/flows/picking";
import { articleName } from "@/lib/article";
import { hotkey } from "@/lib/hotkeys";
import { confirmBatch, putBackBatch, releaseBatchAction, shortageBatch, wasThereBatch } from "../../actions";

export const metadata = { title: "Lote de picking" };

type Share = { order: string; tray: number | null; quantity: number };
/** One stop of the batch: a shelf and a title, the units of every order that wants it. */
type Stop = {
  key: string;
  locationId: number | null;
  productId: number;
  thumb: number | null;
  location: string | null;
  title: string;
  sku: string;
  isbn: string | null;
  barcode: string;
  quantity: number;
  picked: number;
  /** Units still to take, per order (trays tell which goes where). */
  shares: Share[];
  pending: boolean;
  short: number;
};

export default async function PickingBatch({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ parada?: string }> }) {
  const id = Number((await params).id);
  const chosen = (await searchParams).parada;
  const { db, company, user } = await requireSession();
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
    .orderBy(desc(orders.urgent), asc(orders.date), asc(orders.id));
  const lines = await db.select({ quantity: orderLines.quantity, picked: orderLines.picked }).from(orderLines).innerJoin(orders, eq(orders.id, orderLines.orderId)).where(eq(orders.batchId, id));
  const tasks = await db
    .select({ t: pickTasks, order: orders.number, tray: orders.tray, title: products.title, thumb: products.thumbVersion, sku: products.internalCode, isbn: products.isbn, barcode: products.barcode, location: locations.code })
    .from(pickTasks)
    .innerJoin(orders, eq(orders.id, pickTasks.orderId))
    .innerJoin(products, eq(products.id, pickTasks.productId))
    .leftJoin(locations, eq(locations.id, pickTasks.locationId))
    .where(eq(orders.batchId, id))
    .orderBy(asc(locations.code), asc(products.title), desc(orders.urgent), asc(orders.date), asc(orders.id));
  const open = batchOrders.filter(({ o }) => o.status === "in_picking" || o.status === "to_control" || o.status === "picked");
  const toControl = batchOrders.some(({ o }) => o.status === "to_control");
  const [box] = open.length > 0 ? await db.select({ id: boxes.id }).from(boxes).where(inArray(boxes.orderId, open.map(({ o }) => o.id))).limit(1) : [];

  // One stop per shelf and title, whatever the number of orders that want it.
  const stops: Stop[] = [];
  for (const x of tasks) {
    const key = `${x.t.locationId ?? "x"}-${x.t.productId}`;
    let s = stops.find((y) => y.key === key);
    if (!s) stops.push((s = { key, locationId: x.t.locationId, productId: x.t.productId, location: x.location, title: x.title, thumb: x.thumb, sku: x.sku, isbn: x.isbn, barcode: x.barcode, quantity: 0, picked: 0, shares: [], pending: false, short: 0 }));
    s.quantity += x.t.quantity;
    s.picked += x.t.picked;
    if (x.t.status === "short") s.short += x.t.quantity - x.t.picked;
    if (x.t.status === "pending") {
      s.pending = true;
      const left = x.t.quantity - x.t.picked;
      const same = s.shares.find((y) => y.order === x.order);
      if (same) same.quantity += left;
      else s.shares.push({ order: x.order, tray: x.tray, quantity: left });
    }
  }
  const walk = stops.filter((s) => s.locationId != null);
  const pending = walk.filter((s) => s.pending);
  const current = pending.find((s) => s.key === chosen) ?? pending[0];
  const after = current ? (pending[pending.indexOf(current) + 1] ?? pending[0]) : undefined;
  const left = (s: Stop) => s.shares.reduce((n, x) => n + x.quantity, 0);
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const picked = lines.reduce((s, l) => s + l.picked, 0);
  const missing = stops.reduce((n, s) => n + s.short, 0);
  const mine = b.takenBy === user.id;
  const releaseReason = !mine && !can(user.role, "supervisor") ? `Lo está preparando ${row.takenBy}. Solo esa persona o un supervisor puede soltarlo.` : box ? "Ya hay cajas armadas. Vacíalas en empaque antes de soltarlo." : undefined;
  const stopFields = (s: Stop) => ({ batchId: id, locationId: s.locationId!, productId: s.productId });

  return (
    <>
      <PageHeader title={`${batchNumber(b.number)}`} subtitle={`${plural(batchOrders.length, "pedido", "pedidos")}${mine ? "" : ` · Lo prepara ${row.takenBy}`}`} back={{ href: "/picking", text: "Picking" }}>
        <Badge>{trays ? "Por bandeja" : "Se separa en empaque"}</Badge>
        {open.length > 0 && (
          <ActionButton
            action={releaseBatchAction}
            hiddenFields={{ batchId: id }}
            className="btn-soft"
            showOk={false}
            reason={releaseReason}
            confirm={[`¿Soltar el lote ${batchNumber(b.number)}? ${open.length === 1 ? "Su pedido vuelve" : `Sus ${open.length} pedidos vuelven`} a Pendientes.`, picked > 0 && `Devuelve ${picked === 1 ? "la unidad tomada" : `las ${picked} unidades tomadas`} a su ubicación.`].filter(Boolean).join(" ")}
          >
            Soltar lote
          </ActionButton>
        )}
      </PageHeader>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-3 lg:sticky lg:top-30">
          {current ? (
            <section aria-label="Parada actual" className="panel overflow-hidden">
              <div className="bg-accent p-4 text-on-accent" data-scan-code={current.barcode}>
                <p className="mb-2 text-sm font-semibold opacity-85">
                  Parada {walk.indexOf(current) + 1} de {walk.length}
                </p>
                <div className="flex items-end justify-between gap-3">
                  <ShelfMark code={current.location} size="xl" onAccent />
                  <p className="text-right leading-none">
                    <span className="block text-sm opacity-85">Toma</span>
                    <span className="text-4xl font-bold lg:text-3xl">{left(current)}</span>
                  </p>
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <Cover productId={current.productId} version={current.thumb} className="h-30 w-21 border-on-accent/40" />
                  <div className="min-w-0">
                    <p className="text-lg leading-snug font-semibold lg:text-base">{articleName(current.title)}</p>
                    <p className="mt-1 font-mono text-sm font-bold break-all opacity-85">
                      {current.sku}
                      {current.isbn && ` · ${current.isbn}`}
                    </p>
                  </div>
                </div>
                {current.shares.length > 1 && !trays && <p className="mt-2 text-sm opacity-85">Para {current.shares.length} pedidos</p>}
                {trays && (
                  <ul className="mt-3 space-y-1 border-t border-on-accent/25 pt-3 text-sm">
                    {current.shares.map((s) => (
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
              <div className="space-y-3 p-4">
                {/* Kept across confirms, so the reply (with trays: how many go in each) stays readable;
                    a stop chosen with Ir or Saltar starts a fresh form. */}
                <ScanForm
                  key={chosen ?? "route"}
                  action={confirmBatch}
                  context="batch-picking"
                  hiddenFields={stopFields(current)}
                  fields={[
                    { name: "location", label: "1 · Ubicación", help: `Escanea la etiqueta de ${current.location}` },
                    { name: "product", label: "2 · Artículo", help: "Escanea el artículo" },
                  ]}
                  quantity={left(current)}
                  button="Confirmar"
                />
                <div className="flex gap-2">
                  <ActionButton
                    action={shortageBatch}
                    hotkey="secondary"
                    hiddenFields={stopFields(current)}
                    className="btn-soft flex-1"
                    confirm={`¿En ${current.location} no ${left(current) === 1 ? "está la unidad que falta" : `están las ${left(current)} unidades que faltan`}? Pasan a Faltantes y miDepo busca el artículo en otra ubicación. Se puede deshacer con "Sí estaba".`}
                  >
                    No está aquí
                  </ActionButton>
                  {after && after !== current && (
                    <Link href={`/picking/lote/${id}?parada=${after.key}`} className="btn-soft flex-1" replace>
                      Saltar
                      <Icon name="arrow" className="size-4" />
                    </Link>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <Notice tone="ok">
              <p className="mb-3 text-base">
                Recorrido terminado. {missing > 0 ? `Con ${plural(missing, "faltante", "faltantes")}.` : "Completo."} {trays ? "Cada pedido está en su bandeja." : toControl ? "En control se separa por pedido." : "En empaque se separa por pedido."}
              </p>
              <Link href={toControl ? "/control" : "/empaque"} className="btn w-full" {...hotkey("primary")}>
                {toControl ? "Ir a control" : "Ir a empaque"}
              </Link>
            </Notice>
          )}
        </div>

        <div className="min-w-0 space-y-7 lg:space-y-5">
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 className="section-title mb-0">
                Recorrido <small>{plural(pending.length, "parada pendiente", "paradas pendientes")}</small>
              </h2>
              <div className="w-full max-w-72">
                <Progress done={picked} total={total} unit="unidades" />
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th colSpan={2}>Artículo</th>
                    <th className="hidden text-right sm:table-cell">Cantidad</th>
                    <th className="hidden md:table-cell">Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stops.map((s) => {
                    const isCurrent = s === current;
                    const state = s.pending ? isCurrent ? <Badge tone="accent">Ahora</Badge> : <Badge>Pendiente</Badge> : s.short > 0 ? <Badge tone="danger">{s.locationId == null ? `Sin stock · faltan ${s.short}` : `No estaba · faltan ${s.short}`}</Badge> : <Badge tone="ok">Tomado</Badge>;
                    return (
                      <tr key={s.key} className={isCurrent ? "bg-accent-soft" : !s.pending && s.short === 0 ? "text-muted" : ""} aria-current={isCurrent ? "step" : undefined}>
                        <td className="w-px">{s.location ? <ShelfMark code={s.location} /> : <span className="text-muted">—</span>}</td>
                        <td className="w-0 py-1.5! pr-0!">
                          <Cover productId={s.productId} version={s.thumb} className={`h-14 w-10 ${!s.pending && s.short === 0 ? "opacity-60" : ""}`} />
                        </td>
                        <td className="w-full max-w-0">
                          <span className="block truncate font-medium">{articleName(s.title)}</span>
                          <span className="block truncate font-mono text-xs text-muted">
                            {s.sku}
                            {s.shares.length > 1 && <span className="font-sans"> · {s.shares.length} pedidos</span>}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 md:hidden">
                            <span className="text-sm sm:hidden">
                              {s.picked} de {s.quantity}
                            </span>
                            {state}
                          </span>
                        </td>
                        <td className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
                          <span className={!s.pending && s.short === 0 ? "font-semibold text-ok" : "font-semibold"}>{s.picked}</span> de {s.quantity}
                        </td>
                        <td className="hidden whitespace-nowrap md:table-cell">{state}</td>
                        <td className="w-px text-right whitespace-nowrap">
                          {s.pending && !isCurrent && s.locationId != null && (
                            <Link href={`/picking/lote/${id}?parada=${s.key}`} className="btn-sm" replace>
                              Ir
                            </Link>
                          )}
                          {s.picked > 0 && s.short === 0 && s.locationId != null && (
                            <ActionButton action={putBackBatch} hiddenFields={stopFields(s)} className="btn-sm" showOk={false} confirm={`¿Devolver ${plural(s.picked, "unidad", "unidades")} de "${articleName(s.title)}" a ${s.location}? La parada vuelve a quedar pendiente.`}>
                              Devolver
                            </ActionButton>
                          )}
                          {s.short > 0 && s.locationId != null && (
                            <ActionButton action={wasThereBatch} hiddenFields={stopFields(s)} className="btn-sm" showOk={false} confirm={`¿Sí estaba en ${s.location}? Las unidades vuelven de Faltantes a ${s.location} y la parada vuelve al recorrido.`}>
                              Sí estaba
                            </ActionButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

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
                    <th className="hidden sm:table-cell">Condición</th>
                    <th className="text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {batchOrders.map(({ o, customer }) => (
                    <tr key={o.id}>
                      {trays && <td className="text-center text-base font-bold tabular-nums">{o.tray}</td>}
                      <td className="max-w-0 w-full sm:w-auto sm:max-w-none">
                        <span className="doc-number">{o.number}</span>
                        <span className="block truncate text-sm text-muted sm:hidden">
                          {customer} · {SALE_MODE[o.saleMode]}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">{customer}</td>
                      <td className="hidden sm:table-cell">
                        <Condition mode={o.saleMode} href={`/${orderScreen(o.status)}/${o.id}`} />
                      </td>
                      <td className="text-right whitespace-nowrap">{o.status === "in_picking" ? <Badge>En preparación</Badge> : o.status === "to_control" ? <Badge tone="accent">Para control</Badge> : o.status === "picked" ? <Badge tone="accent">Listo para empacar</Badge> : <Badge tone="ok">Empacado</Badge>}</td>
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
