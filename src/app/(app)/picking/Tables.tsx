import Link from "next/link";
import { and, asc, eq, inArray, min, sql, desc } from "drizzle-orm";
import { ActionButton } from "@/components/ScanForm";
import { Progress, shortDate, Badge, ShelfMark, Condition, SALE_MODE } from "@/components/ui";
import { fierroWarning } from "@/lib/orderState";
import { customers, orderLines, orders, pickBatches, pickTasks, locations, users } from "@/db/schema";
import { batchNumber } from "@/lib/flows/picking";
import type { requireSession } from "@/lib/session";
import { take, takeAllOrders } from "./actions";
import { hotkey } from "@/lib/hotkeys";
import { AssigneeCell, type Assignees } from "@/components/Assignee";
import { shortages } from "@/lib/flows/picking";

type Db = Awaited<ReturnType<typeof requireSession>>["db"];

/** Pending and in-progress orders, with the next shelf of each route. */
export async function loadOpenOrders(db: Db, companyId: number) {
  const rows = await db
    .select({
      p: orders,
      customer: customers.name,
      city: customers.city,
      takenBy: users.name,
      lines: sql<number>`count(${orderLines.id})`.mapWith(Number),
      units: sql<number>`coalesce(sum(${orderLines.quantity}), 0)`.mapWith(Number),
      picked: sql<number>`coalesce(sum(${orderLines.picked}), 0)`.mapWith(Number),
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(users, eq(users.id, orders.takenBy))
    .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(and(eq(orders.companyId, companyId), inArray(orders.status, ["pending", "in_picking"])))
    .groupBy(orders.id, customers.name, customers.city, users.name)
    .orderBy(desc(orders.urgent), asc(orders.date))
    .limit(200);
  // Orders in a batch are shown once, as their batch.
  const inProgress = rows.filter((f) => f.p.status === "in_picking" && f.p.batchId == null);
  const pending = rows.filter((f) => f.p.status === "pending");

  const nextShelf = new Map<number, string | null>();
  if (inProgress.length > 0) {
    const stops = await db
      .select({ orderId: pickTasks.orderId, code: min(locations.code) })
      .from(pickTasks)
      .innerJoin(locations, eq(locations.id, pickTasks.locationId))
      .where(and(eq(pickTasks.status, "pending"), inArray(pickTasks.orderId, inProgress.map((f) => f.p.id))))
      .groupBy(pickTasks.orderId);
    for (const x of stops) nextShelf.set(x.orderId, x.code);
  }

  const batches = await db
    .select({
      b: pickBatches,
      takenBy: users.name,
      orders: sql<number>`count(distinct ${orders.id})`.mapWith(Number),
      units: sql<number>`coalesce(sum(${orderLines.quantity}), 0)`.mapWith(Number),
      picked: sql<number>`coalesce(sum(${orderLines.picked}), 0)`.mapWith(Number),
    })
    .from(pickBatches)
    .innerJoin(users, eq(users.id, pickBatches.takenBy))
    .innerJoin(orders, eq(orders.batchId, pickBatches.id))
    .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(and(eq(pickBatches.companyId, companyId), eq(pickBatches.status, "open")))
    .groupBy(pickBatches.id, users.name)
    .orderBy(asc(pickBatches.number));
  const batchShelf = new Map<number, string | null>();
  if (batches.length > 0) {
    const stops = await db
      .select({ batchId: orders.batchId, code: min(locations.code) })
      .from(pickTasks)
      .innerJoin(orders, eq(orders.id, pickTasks.orderId))
      .innerJoin(locations, eq(locations.id, pickTasks.locationId))
      .where(and(eq(pickTasks.status, "pending"), inArray(orders.batchId, batches.map((x) => x.b.id))))
      .groupBy(orders.batchId);
    for (const x of stops) batchShelf.set(x.batchId!, x.code);
  }
  const short = await shortages(db, companyId, pending.map((f) => f.p.id));
  return {
    inProgress: inProgress.map((f) => ({ ...f, nextShelf: nextShelf.get(f.p.id) ?? null })),
    pending: pending.map((f) => ({ ...f, short: short.get(f.p.id) ?? 0 })),
    batches: batches.map((x) => ({ ...x, nextShelf: batchShelf.get(x.b.id) ?? null })),
  };
}

type OpenOrders = Awaited<ReturnType<typeof loadOpenOrders>>;

/** Each order in progress leads with the shelf mark of the shelf it goes to next. */
export function InProgressTable({ rows, userId }: { rows: OpenOrders["inProgress"]; userId: number }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Próxima ubicación</th>
            <th>Pedido</th>
            <th className="hidden sm:table-cell">Condición</th>
            <th className="hidden sm:table-cell">Usuario</th>
            <th className="hidden w-[30%] min-w-36 sm:table-cell">Progreso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, customer, takenBy, units, picked, nextShelf }) => (
            <tr key={p.id} className={p.takenBy === userId ? "bg-accent-soft" : ""}>
              <td>{nextShelf ? <ShelfMark code={nextShelf} size="md" /> : <Badge tone="ok">Recorrido terminado</Badge>}</td>
              <td>
                {/* F2 carries on with your own order first (it is marked earlier on the page than "Preparar"). */}
                <Link href={`/picking/${p.id}`} className="link doc-number" {...(p.id === rows.find((r) => r.p.takenBy === userId)?.p.id ? hotkey("primary", `Seguir con el pedido ${p.number}`) : {})}>
                  {p.number}
                </Link>
                {p.urgent && (
                  <>
                    {" "}
                    <Badge tone="danger">Urgente</Badge>
                  </>
                )}
                <span className="block max-w-40 truncate text-muted sm:max-w-64">{customer}</span>
                <span className="block text-muted sm:hidden">
                  {picked} de {units} · {SALE_MODE[p.saleMode]} · {p.takenBy === userId ? "tú" : (takenBy ?? "otra persona")}
                </span>
              </td>
              <td className="hidden sm:table-cell">
                <Condition mode={p.saleMode} href={`/picking/${p.id}`} />
              </td>
              <td className="hidden sm:table-cell">{p.takenBy === userId ? <strong>Tú</strong> : (takenBy ?? "Otra persona")}</td>
              <td className="hidden sm:table-cell">
                <Progress done={picked} total={units} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PendingTable({ rows, a }: { rows: OpenOrders["pending"]; a: Assignees }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th className="hidden sm:table-cell">Condición</th>
            <th className="hidden md:table-cell">Localidad</th>
            <th className="hidden sm:table-cell">Asignado</th>
            <th className="hidden text-right sm:table-cell">Artículos</th>
            <th className="hidden text-right sm:table-cell">Unidades</th>
            <th className="hidden sm:table-cell">Faltantes</th>
            <th className="hidden md:table-cell">Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, customer, city, lines, units, short }, i) => (
            <tr key={p.id}>
              <td>
                <Link href={`/picking/${p.id}`} className="link doc-number">
                  {p.number}
                </Link>
              </td>
              <td>
                <span className="font-medium">{customer}</span>
                {p.urgent && (
                  <>
                    {" "}
                    <Badge tone="danger">Urgente</Badge>
                  </>
                )}
                <span className="block text-muted md:hidden">
                  <span className="sm:hidden">
                    {units} u. · {SALE_MODE[p.saleMode]} ·{" "}
                  </span>
                  {city}
                </span>
                {short > 0 && (
                  <span className="mt-1 block sm:hidden">
                    <Badge tone="danger">Sin stock · {short}</Badge>
                  </span>
                )}
              </td>
              <td className="hidden sm:table-cell">
                <Condition mode={p.saleMode} href={`/picking/${p.id}`} />
              </td>
              <td className="hidden text-muted md:table-cell">{city}</td>
              <td className="hidden sm:table-cell">
                <AssigneeCell a={a} kind="order" id={p.id} value={p.assignedTo} />
              </td>
              <td className="hidden text-right sm:table-cell">{lines}</td>
              <td className="hidden text-right font-semibold sm:table-cell">{units}</td>
              <td className="hidden w-px whitespace-nowrap sm:table-cell">{short > 0 && <Badge tone="danger">Sin stock · {short}</Badge>}</td>
              <td className="hidden whitespace-nowrap text-muted md:table-cell">{shortDate(p.date)}</td>
              <td className="w-px text-right">
                <ActionButton action={take} hiddenFields={{ id: p.id }} showOk={false} className="btn-sm" hotkey={i === 0 ? "primary" : undefined} reason={fierroWarning(p) ?? undefined}>
                  Preparar
                </ActionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Batches being picked: like orders in progress, one row per batch. */
export function BatchesTable({ rows, userId }: { rows: OpenOrders["batches"]; userId: number }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Próxima ubicación</th>
            <th>Lote</th>
            <th className="hidden sm:table-cell">Usuario</th>
            <th className="hidden w-[30%] min-w-36 sm:table-cell">Progreso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ b, takenBy, orders: n, units, picked, nextShelf }) => (
            <tr key={b.id} className={b.takenBy === userId ? "bg-accent-soft" : ""}>
              <td>{nextShelf ? <ShelfMark code={nextShelf} size="md" /> : <Badge tone="ok">Recorrido terminado</Badge>}</td>
              <td>
                <Link href={`/picking/lote/${b.id}`} className="link doc-number" {...(b.id === rows.find((r) => r.b.takenBy === userId)?.b.id ? hotkey("primary", `Seguir con el lote ${batchNumber(b.number)}`) : {})}>
                  {batchNumber(b.number)}
                </Link>
                <span className="block text-muted">
                  {n === 1 ? "1 pedido" : `${n} pedidos`}
                  <span className="sm:hidden">
                    {" "}
                    · {picked} de {units} · {b.takenBy === userId ? "tú" : takenBy}
                  </span>
                </span>
              </td>
              <td className="hidden sm:table-cell">{b.takenBy === userId ? <strong>Tú</strong> : takenBy}</td>
              <td className="hidden sm:table-cell">
                <Progress done={picked} total={units} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Preparar todos": every pending order in one batch, asked first. */
export function TakeAllButton({ count }: { count: number }) {
  return (
    <ActionButton action={takeAllOrders} showOk={false} className="btn-sm" hotkey="secondary" confirm={`¿Preparar los ${count} pedidos pendientes en un solo recorrido? Quedan a tu nombre.`}>
      Preparar todos
    </ActionButton>
  );
}
