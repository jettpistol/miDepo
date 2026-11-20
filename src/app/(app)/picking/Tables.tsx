import Link from "next/link";
import { and, asc, eq, inArray, min, sql } from "drizzle-orm";
import { ActionButton } from "@/components/ScanForm";
import { Progress, shortDate, Badge, ShelfMark } from "@/components/ui";
import { customers, orderLines, orders, pickTasks, locations, users } from "@/db/schema";
import type { requireSession } from "@/lib/session";
import { take } from "./actions";
import { hotkey } from "@/lib/hotkeys";

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
    .orderBy(asc(orders.date))
    .limit(200);
  const inProgress = rows.filter((f) => f.p.status === "in_picking");
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
  return { inProgress: inProgress.map((f) => ({ ...f, nextShelf: nextShelf.get(f.p.id) ?? null })), pending };
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
                <span className="block max-w-40 truncate text-muted sm:max-w-64">{customer}</span>
                <span className="block text-muted sm:hidden">
                  {picked} de {units} · {p.takenBy === userId ? "tú" : (takenBy ?? "otra persona")}
                </span>
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

export function PendingTable({ rows }: { rows: OpenOrders["pending"] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th className="hidden md:table-cell">Localidad</th>
            <th className="hidden text-right sm:table-cell">Artículos</th>
            <th className="hidden text-right sm:table-cell">Unidades</th>
            <th className="hidden md:table-cell">Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, customer, city, lines, units }, i) => (
            <tr key={p.id}>
              <td>
                <Link href={`/picking/${p.id}`} className="link doc-number">
                  {p.number}
                </Link>
              </td>
              <td>
                <span className="font-medium">{customer}</span>
                {p.saleMode === "consignment" && (
                  <>
                    {" "}
                    <Badge>Consignación</Badge>
                  </>
                )}
                <span className="block text-muted md:hidden">
                  <span className="sm:hidden">{units} u. · </span>
                  {city}
                </span>
              </td>
              <td className="hidden text-muted md:table-cell">{city}</td>
              <td className="hidden text-right sm:table-cell">{lines}</td>
              <td className="hidden text-right font-semibold sm:table-cell">{units}</td>
              <td className="hidden whitespace-nowrap text-muted md:table-cell">{shortDate(p.date)}</td>
              <td className="w-px text-right">
                <ActionButton action={take} hiddenFields={{ id: p.id }} showOk={false} className="btn-sm" hotkey={i === 0 ? "primary" : undefined}>
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
