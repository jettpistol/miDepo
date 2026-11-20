import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ActionButton, ScanForm } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { Progress, Notice, PageHeader, Badge, ShelfMark, plural } from "@/components/ui";
import { boxes, customers, orderLines, orders, products, pickTasks, locations, users } from "@/db/schema";
import { can, requireSession } from "@/lib/session";
import { confirm, putBack, release, shortage, take, wasThere } from "../actions";
import { hotkey } from "@/lib/hotkeys";
import { articleName } from "@/lib/article";
import { Assignee } from "@/components/Assignee";
import { Urgency } from "@/components/Urgency";
import { fierroWarning } from "@/lib/orderState";
import { planRoute } from "@/lib/flows/picking";

export default async function PickingOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ parada?: string }> }) {
  const id = Number((await params).id);
  const chosen = Number((await searchParams).parada);
  const session = await requireSession();
  const { db, company, user } = session;
  const [row] = await db
    .select({ p: orders, customer: customers.name, takenBy: users.name })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(users, eq(users.id, orders.takenBy))
    .where(and(eq(orders.id, id), eq(orders.companyId, company.id)));
  if (!row) notFound();
  const { p, customer, takenBy } = row;
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));
  const tasks = await db
    .select({ t: pickTasks, title: products.title, barcode: products.barcode, sku: products.internalCode, isbn: products.isbn, location: locations.code })
    .from(pickTasks)
    .innerJoin(products, eq(products.id, pickTasks.productId))
    .leftJoin(locations, eq(locations.id, pickTasks.locationId))
    .where(eq(pickTasks.orderId, id))
    .orderBy(asc(locations.code), asc(products.title), asc(pickTasks.id));
  const [box] = await db.select({ id: boxes.id }).from(boxes).where(eq(boxes.orderId, id)).limit(1);

  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const picked = lines.reduce((s, l) => s + l.picked, 0);
  const pending = tasks.filter((x) => x.t.status === "pending");
  const missing = tasks.filter((x) => x.t.status === "short").reduce((s, x) => s + x.t.quantity - x.t.picked, 0);
  // The stop to do now: the one chosen from the list, or the next one on the route.
  const current = pending.find((x) => x.t.id === chosen) ?? pending[0];
  const after = current ? (pending[pending.indexOf(current) + 1] ?? pending[0]) : undefined;
  const editable = p.status === "in_picking" || p.status === "to_control" || p.status === "picked";
  const mine = p.takenBy === user.id;
  const releaseReason = !mine && !can(user.role, "supervisor") ? `Lo está preparando ${takenBy ?? "otra persona"}. Solo esa persona o un supervisor puede soltarlo.` : box ? "Ya hay cajas armadas. Vacíalas en empaque antes de soltarlo." : undefined;
  const warning = fierroWarning(p);
  // Before anyone takes it: the route taking it would build now, so the order can be read first.
  const preview = ["pending", "cancelled"].includes(p.status) ? await previewRoute(db, company.id, id) : [];
  const previewShort = preview.filter((x) => x.location == null).reduce((s, x) => s + x.quantity, 0);
  const missingInRoute = tasks.filter((x) => x.t.sentToMissing > 0).reduce((s, x) => s + x.t.sentToMissing, 0);

  return (
    <>
      <PageHeader title={`Pedido ${p.number}`} subtitle={p.status !== "pending" && !mine && takenBy ? `${customer} · Lo prepara ${takenBy}` : customer} back={{ href: "/picking", text: "Picking" }} meta={<Assignee session={session} kind="order" id={p.id} value={p.assignedTo} open={["pending", "in_picking", "to_control", "picked"].includes(p.status)} />}>
        {p.saleMode === "consignment" && <Badge>Consignación</Badge>}
        <Urgency session={session} order={p} />
        {editable && (
          <ActionButton
            action={release}
            hiddenFields={{ id }}
            className="btn-soft"
            showOk={false}
            reason={releaseReason}
            confirm={[
              `¿Soltar el pedido ${p.number}? Vuelve a Pendientes y cualquiera puede tomarlo.`,
              picked > 0 && `Devuelve ${picked === 1 ? "la unidad tomada" : `las ${picked} unidades tomadas`} a su ubicación.`,
              missingInRoute > 0 && `${missingInRoute === 1 ? "La unidad que marcaste como no encontrada sigue" : `Las ${missingInRoute} unidades que marcaste como no encontradas siguen`} en Faltantes; si sí estaban, usa "Sí estaba" antes de soltar.`,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Soltar pedido
          </ActionButton>
        )}
      </PageHeader>

      {warning && <Notice tone="warn">{warning}</Notice>}
      {p.status === "in_picking" && p.batchId != null ? (
        <Notice tone="accent">
          <p className="mb-3">Este pedido se prepara en un lote, junto con otros.</p>
          <Link href={`/picking/lote/${p.batchId}`} className="btn" {...hotkey("primary")}>
            Ir al lote
          </Link>
        </Notice>
      ) : p.status === "pending" || p.status === "cancelled" ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-3 lg:sticky lg:top-30">
            <p>
              <strong>{plural(total, "unidad", "unidades")}</strong> de {plural(lines.length, "artículo", "artículos")}{p.status === "pending" && ". Todavía no lo tomó nadie; el stock se reserva al tomarlo"}.
            </p>
            {previewShort > 0 && <Notice tone="danger">Sin stock en estanterías para {plural(previewShort, "unidad", "unidades")}: saldrían como faltantes.</Notice>}
            <ActionButton action={take} hiddenFields={{ id }} className="btn w-full" showOk={false} hotkey="primary" reason={warning ?? undefined}>
              Preparar este pedido
            </ActionButton>
          </div>
          <section className="min-w-0">
            <h2 className="section-title">
              Recorrido previsto <small>{plural(preview.filter((x) => x.location != null).length, "parada", "paradas")}</small>
            </h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th>Artículo</th>
                    <th className="text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((x, i) => (
                    <tr key={i}>
                      <td className="w-px">{x.location ? <ShelfMark code={x.location} /> : <span className="text-muted">—</span>}</td>
                      <td className="max-w-0 w-full">
                        <span className="block truncate font-medium">{articleName(x.title)}</span>
                        <span className="block truncate font-mono text-xs text-muted">
                          {x.sku}
                          {x.isbn && ` · ${x.isbn}`}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap tabular-nums">{x.location ? <span className="font-semibold">{x.quantity}</span> : <Badge tone="danger">Sin stock · {x.quantity}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-3 lg:sticky lg:top-30">
            {current ? (
              <section aria-label="Parada actual" className="panel overflow-hidden">
                <div className="bg-accent p-4 text-on-accent" data-scan-code={current.barcode}>
                  <p className="mb-2 text-sm font-semibold opacity-85">
                    Parada {tasks.filter((x) => x.t.locationId != null).indexOf(current) + 1} de {tasks.filter((x) => x.t.locationId != null).length}
                  </p>
                  <div className="flex items-end justify-between gap-3">
                    <ShelfMark code={current.location} size="xl" onAccent />
                    <p className="text-right leading-none">
                      <span className="block text-sm opacity-85">Toma</span>
                      <span className="text-4xl font-bold lg:text-3xl">{current.t.quantity - current.t.picked}</span>
                    </p>
                  </div>
                  <p className="mt-3 text-lg leading-snug font-semibold lg:text-base">{articleName(current.title)}</p>
                  <p className="font-mono text-sm font-bold opacity-85">
                    {current.sku}
                    {current.isbn && ` · ${current.isbn}`}
                  </p>
                </div>
                <div className="space-y-3 p-4">
                  <ScanForm
                    key={current.t.id}
                    action={confirm}
                    context="picking"
                    hiddenFields={{ taskId: current.t.id }}
                    fields={[
                      { name: "location", label: "1 · Ubicación", help: `Escanea la etiqueta de ${current.location}` },
                      { name: "product", label: "2 · Artículo", help: "Escanea el artículo" },
                    ]}
                    quantity={current.t.quantity - current.t.picked}
                    button="Confirmar"
                  />
                  <div className="flex gap-2">
                    <ActionButton
                      action={shortage}
                      hotkey="secondary"
                      hiddenFields={{ taskId: current.t.id }}
                      className="btn-soft flex-1"
                      confirm={`¿En ${current.location} no ${current.t.quantity - current.t.picked === 1 ? "está la unidad que falta" : `están las ${current.t.quantity - current.t.picked} unidades que faltan`}? Pasan a Faltantes y miDepo busca el artículo en otra ubicación. Se puede deshacer con "Sí estaba".`}
                    >
                      No está aquí
                    </ActionButton>
                    {after && after !== current && (
                      <Link href={`/picking/${id}?parada=${after.t.id}`} className="btn-soft flex-1" replace>
                        Saltar
                        <Icon name="arrow" className="size-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            ) : p.status === "to_control" ? (
              <Notice tone="ok">
                <p className="mb-3 text-base">Recorrido terminado. {missing > 0 ? `Con ${plural(missing, "faltante", "faltantes")}.` : "Completo."} Antes de empacar pasa por control.</p>
                <Link href={`/control/${id}`} className="btn w-full" {...hotkey("primary")}>
                  Ir a control
                </Link>
              </Notice>
            ) : p.status === "picked" ? (
              <Notice tone="ok">
                <p className="mb-3 text-base">Recorrido terminado. {missing > 0 ? `Con ${plural(missing, "faltante", "faltantes")}.` : "Completo."}</p>
                <Link href={`/empaque/${id}`} className="btn w-full" {...hotkey("primary")}>
                  Ir a empacar
                </Link>
              </Notice>
            ) : (
              <Notice tone="ok">Pedido en empaque.</Notice>
            )}
          </div>

          <section className="min-w-0">
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
                    <th>Artículo</th>
                    <th className="hidden text-right sm:table-cell">Cantidad</th>
                    <th className="hidden md:table-cell">Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(({ t, title, sku, location }) => {
                    const isCurrent = t === current?.t;
                    const left = t.quantity - t.picked;
                    const state =
                      t.status === "done" ? (
                        <Badge tone="ok">Tomado</Badge>
                      ) : t.status === "short" ? (
                        <Badge tone="danger">{t.locationId == null ? `Sin stock · faltan ${left}` : `No estaba · faltan ${left}`}</Badge>
                      ) : isCurrent ? (
                        <Badge tone="accent">Ahora</Badge>
                      ) : (
                        <Badge>Pendiente</Badge>
                      );
                    return (
                      <tr key={t.id} className={isCurrent ? "bg-accent-soft" : t.status === "done" ? "text-muted" : ""} aria-current={isCurrent ? "step" : undefined}>
                        <td className="w-px">{location ? <ShelfMark code={location} /> : <span className="text-muted">—</span>}</td>
                        <td className="max-w-0 w-full">
                          <span className="block truncate font-medium">{articleName(title)}</span>
                          <span className="block truncate font-mono text-xs text-muted">{sku}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 md:hidden">
                            <span className="text-sm sm:hidden">
                              {t.picked} de {t.quantity}
                            </span>
                            {state}
                          </span>
                        </td>
                        <td className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
                          <span className={t.status === "done" ? "font-semibold text-ok" : "font-semibold"}>{t.picked}</span> de {t.quantity}
                        </td>
                        <td className="hidden whitespace-nowrap md:table-cell">{state}</td>
                        <td className="w-px text-right whitespace-nowrap">
                          {editable && t.status === "pending" && !isCurrent && (
                            <Link href={`/picking/${id}?parada=${t.id}`} className="btn-sm" replace>
                              Ir
                            </Link>
                          )}
                          {editable && t.picked > 0 && t.status !== "short" && (
                            <ActionButton action={putBack} hiddenFields={{ taskId: t.id }} className="btn-sm" showOk={false} confirm={`¿Devolver ${plural(t.picked, "unidad", "unidades")} de "${articleName(title)}" a ${location}? La parada vuelve a quedar pendiente.`}>
                              Devolver
                            </ActionButton>
                          )}
                          {editable && t.status === "short" && t.locationId != null && (
                            <ActionButton action={wasThere} hiddenFields={{ taskId: t.id }} className="btn-sm" showOk={false} confirm={`¿Sí estaba en ${location}? Las unidades vuelven de Faltantes a ${location} y la parada vuelve al recorrido.`}>
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
        </div>
      )}
    </>
  );
}

async function previewRoute(db: Awaited<ReturnType<typeof requireSession>>["db"], companyId: number, orderId: number) {
  const stops = await planRoute(db, companyId, orderId);
  const ids = [...new Set(stops.map((s) => s.productId))];
  const locIds = [...new Set(stops.map((s) => s.locationId).filter((l): l is number => l != null))];
  const prods = ids.length ? await db.select({ id: products.id, title: products.title, sku: products.internalCode, isbn: products.isbn }).from(products).where(inArray(products.id, ids)) : [];
  const locs = locIds.length ? await db.select({ id: locations.id, code: locations.code }).from(locations).where(inArray(locations.id, locIds)) : [];
  const prod = new Map(prods.map((x) => [x.id, x]));
  const loc = new Map(locs.map((x) => [x.id, x.code]));
  return stops
    .map((s) => {
      const p = prod.get(s.productId)!;
      return { title: p.title, sku: p.sku, isbn: p.isbn, quantity: s.quantity, location: s.locationId != null ? (loc.get(s.locationId) ?? null) : null };
    })
    .sort((a, b) => (a.location == null ? 1 : 0) - (b.location == null ? 1 : 0) || (a.location ?? "").localeCompare(b.location ?? "") || a.title.localeCompare(b.title));
}
