import { and, asc, count, eq, gte, inArray, ne, sql, sum } from "drizzle-orm";
import type { DB } from "@/db";
import { countLocations, counts, customers, locations, movements, orderLines, orders, receivingLines, receivings, returnLines, returns, stock, suppliers, users } from "@/db/schema";
import type { AssignKind } from "./flows/assignments";
import type { IconName } from "@/components/Icon";

/** One open piece of work, whoever has it: what it is, where to go, how far along it is. */
export type Task = {
  kind: AssignKind;
  id: number;
  /** The document number or name: PED-00012, REC-0003, "Pasillo A". */
  name: string;
  detail: string;
  href: string;
  assignedTo: number | null;
  /** Orders only: the person picking it now. */
  takenBy: number | null;
  done: number;
  total: number;
  /** What the person does next, as a button label. */
  verb: string;
  date: Date;
};

export const KIND: Record<AssignKind, { one: string; many: string; icon: IconName }> = {
  order: { one: "pedido", many: "pedidos", icon: "picking" },
  receiving: { one: "recepción", many: "recepciones", icon: "receiving" },
  return: { one: "devolución", many: "devoluciones", icon: "return" },
  count: { one: "conteo", many: "conteos", icon: "count" },
  putaway: { one: "reposición", many: "reposiciones", icon: "putaway" },
};

/** Everything open in the warehouse, as tasks. Orders: the 300 oldest (a busy day has fewer). */
export async function openTasks(db: DB, companyId: number): Promise<Task[]> {
  const [orderRows, receivingRows, returnRows, countRows, zoneRows] = await Promise.all([
    db
      .select({
        o: orders,
        customer: customers.name,
        units: sql<number>`coalesce(sum(${orderLines.quantity}), 0)`.mapWith(Number),
        picked: sql<number>`coalesce(sum(${orderLines.picked}), 0)`.mapWith(Number),
        checked: sql<number>`coalesce(sum(${orderLines.checked}), 0)`.mapWith(Number),
        packed: sql<number>`coalesce(sum(${orderLines.packed}), 0)`.mapWith(Number),
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
      .where(and(eq(orders.companyId, companyId), inArray(orders.status, ["pending", "in_picking", "to_control", "picked"])))
      .groupBy(orders.id, customers.name)
      .orderBy(asc(orders.date))
      .limit(300),
    db
      .select({
        r: receivings,
        supplier: suppliers.name,
        expected: sql<number>`coalesce(sum(${receivingLines.expected}), 0)`.mapWith(Number),
        received: sql<number>`coalesce(sum(${receivingLines.received}), 0)`.mapWith(Number),
      })
      .from(receivings)
      .innerJoin(suppliers, eq(suppliers.id, receivings.supplierId))
      .leftJoin(receivingLines, eq(receivingLines.receivingId, receivings.id))
      .where(and(eq(receivings.companyId, companyId), ne(receivings.status, "closed")))
      .groupBy(receivings.id, suppliers.name)
      .orderBy(asc(receivings.date)),
    db
      .select({ d: returns, customer: customers.name, units: sql<number>`coalesce(sum(${returnLines.quantity}), 0)`.mapWith(Number) })
      .from(returns)
      .innerJoin(customers, eq(customers.id, returns.customerId))
      .leftJoin(returnLines, eq(returnLines.returnId, returns.id))
      .where(and(eq(returns.companyId, companyId), eq(returns.status, "in_progress")))
      .groupBy(returns.id, customers.name)
      .orderBy(asc(returns.date)),
    db
      .select({
        k: counts,
        total: sql<number>`count(${countLocations.locationId})`.mapWith(Number),
        counted: sql<number>`count(*) filter (where ${countLocations.status} = 'counted')`.mapWith(Number),
      })
      .from(counts)
      .leftJoin(countLocations, eq(countLocations.countId, counts.id))
      .where(and(eq(counts.companyId, companyId), eq(counts.status, "open")))
      .groupBy(counts.id)
      .orderBy(asc(counts.date)),
    db
      .select({ z: locations, units: sql<number>`coalesce(sum(${stock.quantity}), 0)`.mapWith(Number) })
      .from(locations)
      .leftJoin(stock, eq(stock.locationId, locations.id))
      .where(and(eq(locations.companyId, companyId), inArray(locations.type, ["receiving", "returns"])))
      .groupBy(locations.id)
      .orderBy(asc(locations.type)),
  ]);

  return [
    ...orderRows.map(({ o, customer, units, picked, checked, packed }): Task => {
      const packing = o.status === "picked";
      const control = o.status === "to_control";
      return {
        kind: "order",
        id: o.id,
        name: o.number,
        detail: customer,
        href: packing ? `/empaque/${o.id}` : control ? `/control/${o.id}` : `/picking/${o.id}`,
        assignedTo: o.assignedTo,
        takenBy: o.status === "in_picking" ? o.takenBy : null,
        done: packing ? packed : control ? checked : picked,
        total: control ? picked : units,
        verb: packing ? "Empacar" : control ? "Controlar" : o.status === "in_picking" ? "Seguir" : "Preparar",
        date: o.date,
      };
    }),
    ...receivingRows.map(({ r, supplier, expected, received }): Task => ({
      kind: "receiving",
      id: r.id,
      name: r.number,
      detail: supplier,
      href: `/recepcion/${r.id}`,
      assignedTo: r.assignedTo,
      takenBy: null,
      done: received,
      total: expected,
      verb: r.status === "in_progress" ? "Seguir" : "Recibir",
      date: r.date,
    })),
    ...returnRows.map(({ d, customer, units }): Task => ({ kind: "return", id: d.id, name: d.number, detail: customer, href: `/devoluciones/${d.id}`, assignedTo: d.assignedTo, takenBy: null, done: units, total: 0, verb: "Seguir", date: d.date })),
    ...countRows.map(({ k, total, counted }): Task => ({ kind: "count", id: k.id, name: k.name, detail: "Conteo", href: `/conteos/${k.id}`, assignedTo: k.assignedTo, takenBy: null, done: counted, total, verb: "Contar", date: k.date })),
    // A zone is work only while it holds something to put away.
    ...zoneRows
      .filter((z) => z.units > 0)
      .map(({ z, units }): Task => ({
        kind: "putaway",
        id: z.id,
        name: z.type === "receiving" ? "Desde Recepción" : "Desde Devoluciones",
        detail: `${units} unidades por guardar`,
        href: z.type === "receiving" ? "/reposicion" : "/reposicion?zona=devoluciones",
        assignedTo: z.assignedTo,
        takenBy: null,
        done: 0,
        total: units,
        verb: "Guardar",
        date: new Date(0),
      })),
  ];
}

/** Yours: what a supervisor gave you, plus the order you are picking. */
export const isMine = (t: Task, userId: number) => t.assignedTo === userId || t.takenBy === userId;
/** Nobody's: not given to anyone, and nobody is on it. */
export const isUnassigned = (t: Task) => t.assignedTo == null && t.takenBy == null;

/** People who can be given work: active, in this company. */
export async function assignablePeople(db: DB, companyId: number) {
  return db.select({ id: users.id, name: users.name, role: users.role, accent: users.accent, photoVersion: users.photoVersion }).from(users).where(and(eq(users.companyId, companyId), eq(users.active, true))).orderBy(asc(users.name));
}

// Argentina has had no daylight saving time since 2009: a day starts at 03:00 UTC.
const TZ = "America/Argentina/Buenos_Aires";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const startOfDay = (key: string) => new Date(`${key}T00:00:00-03:00`);

export type DayActivity = { key: string; label: string; received: number; picked: number; shipped: number };

/** Units received, picked and shipped per day, for the last 7 days (today last). */
export async function weekActivity(db: DB, companyId: number, now = new Date()): Promise<DayActivity[]> {
  const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - (6 - i) * 86_400_000)));
  // Grouped by hour in SQL, then by local day here: no time-zone tables needed in the database.
  const rows = await db
    .select({ hour: sql<string>`to_char(date_trunc('hour', ${movements.createdAt} at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"')`, reason: movements.reason, n: sum(movements.quantity).mapWith(Number) })
    .from(movements)
    .where(and(eq(movements.companyId, companyId), gte(movements.createdAt, startOfDay(days[0])), inArray(movements.reason, ["receiving", "picking", "shipment"])))
    .groupBy(sql`1`, movements.reason);
  const label = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, weekday: "short", day: "numeric" });
  const byDay = new Map(days.map((key, i) => [key, { key, label: i === 6 ? "Hoy" : label.format(startOfDay(key)).replace(".", ""), received: 0, picked: 0, shipped: 0 }]));
  for (const r of rows) {
    const d = byDay.get(dayKey(new Date(r.hour)));
    if (!d) continue;
    if (r.reason === "receiving") d.received += r.n;
    else if (r.reason === "picking") d.picked += r.n;
    else d.shipped += r.n;
  }
  return [...byDay.values()];
}

/** Units each person moved today (any scan that moved stock). */
export async function movedToday(db: DB, companyId: number, now = new Date()) {
  const rows = await db
    .select({ userId: movements.userId, n: sum(movements.quantity).mapWith(Number) })
    .from(movements)
    .where(and(eq(movements.companyId, companyId), gte(movements.createdAt, startOfDay(dayKey(now))), ne(movements.reason, "initial")))
    .groupBy(movements.userId);
  return new Map(rows.filter((r) => r.userId != null).map((r) => [r.userId!, r.n]));
}

/** Units sitting in the zones that are still work: put away, or look for, or write off. */
export async function zoneStock(db: DB, companyId: number) {
  const rows = await db
    .select({ code: locations.code, type: locations.type, units: sql<number>`coalesce(sum(${stock.quantity}), 0)`.mapWith(Number) })
    .from(locations)
    .leftJoin(stock, eq(stock.locationId, locations.id))
    .where(and(eq(locations.companyId, companyId), inArray(locations.type, ["receiving", "returns", "missing", "damaged"])))
    .groupBy(locations.id);
  const ORDER = ["receiving", "returns", "missing", "damaged"] as const;
  const HREF = { receiving: "/reposicion", returns: "/reposicion?zona=devoluciones", missing: "/bajas", damaged: "/bajas" };
  return ORDER.flatMap((type) => rows.filter((r) => r.type === type).map((r) => ({ ...r, type, href: HREF[type] })));
}

/** Orders per stage, from waiting to be picked to waiting to be documented in Fierro. */
export async function orderStages(db: DB, companyId: number) {
  const rows = await db
    .select({ status: orders.status, n: count() })
    .from(orders)
    .where(and(eq(orders.companyId, companyId), inArray(orders.status, ["pending", "in_picking", "to_control", "picked", "packed"])))
    .groupBy(orders.status);
  const n = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  return [
    { key: "pending", label: "Para preparar", n: n("pending"), href: "/picking" },
    { key: "in_picking", label: "En preparación", n: n("in_picking"), href: "/picking" },
    { key: "to_control", label: "Para controlar", n: n("to_control"), href: "/control" },
    { key: "picked", label: "Para empacar", n: n("picked"), href: "/empaque" },
    { key: "packed", label: "Empacados, sin cargar en Fierro", n: n("packed"), href: "/fierro" },
  ];
}
