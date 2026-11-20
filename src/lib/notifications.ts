import { and, count, desc, eq, inArray, isNotNull, isNull, like, lt, or, sql, sum } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { companies, counts, locations, movements, notifications, orders, receivings, returns, stock, users, type Role } from "@/db/schema";
import { toDispatch } from "./flows/dispatch";
import { pendingExports } from "./flows/exports";

/**
 * Notifications are for work that needs someone's time, not for every scan: work assigned to you,
 * a count waiting for approval, a shortage to decide on, packed orders to load in Fierro, what is
 * still open at the end of the day. Each kind goes only to the roles that act on it (or only to the
 * people it names), never to the person who caused it, and each person can turn kinds off in
 * Ajustes. See "Notifications" in docs/DECISIONS.md.
 */

const ALL: Role[] = ["operator", "supervisor", "admin"];
const DESK: Role[] = ["supervisor", "admin"];

/** After this long with no pick, an order in picking is reported as stalled. */
export const STALL_HOURS = 2;
/** Local hour from which the end-of-day notice goes out. */
export const DAY_END_HOUR = 17;

/** Names are one to three words (they label a switch in Ajustes); `when` is its hint. */
export const KINDS = {
  assigned: { name: "Asignaciones", when: "Trabajo asignado a ti.", roles: ALL },
  urgent: { name: "Urgencias", when: "Un pedido asignado a ti o en tu picking pasó a urgente.", roles: ALL },
  recount: { name: "Recuentos", when: "Ubicación para volver a contar. No llega a quien contó primero.", roles: ["operator", "supervisor"] as Role[] },
  count_ready: { name: "Conteo para aprobar", when: "Todas las ubicaciones del conteo están contadas.", roles: DESK },
  to_load: { name: "Pedidos sin cargar", when: "Pedidos empacados pendientes de cargar en Fierro.", roles: DESK },
  shortage: { name: "Faltantes", when: "Unidades no encontradas en picking o en control, pasadas a FALTANTES.", roles: DESK },
  receiving_differences: { name: "Recepción con diferencias", when: "Recepción cerrada con unidades de más, de menos, sin aviso o dañadas.", roles: DESK },
  stalled_picking: { name: "Pedido sin avances", when: `Pedido en picking sin unidades tomadas en ${STALL_HOURS} h.`, roles: DESK },
  fierro_changes: { name: "Cambios en Fierro", when: "Fierro cambió o quitó pedidos ya empezados.", roles: DESK },
  day_end: { name: "Cierre del día", when: `Desde las ${DAY_END_HOUR} h, una vez por día: lo que queda abierto.`, roles: DESK },
  write_off: { name: "Bajas", when: "Unidades dadas de baja, desde Bajas o al aprobar un conteo.", roles: ["admin"] as Role[] },
  new_work: { name: "Trabajo nuevo", when: "Pedidos o recepciones nuevas de Fierro.", roles: ALL },
} satisfies Record<string, { name: string; when: string; roles: Role[] }>;

export type Kind = keyof typeof KINDS;
export const isKind = (v: string): v is Kind => v in KINDS;
/** The kinds a role can receive, in the order Mi cuenta lists them. */
export const kindsFor = (role: Role) => (Object.keys(KINDS) as Kind[]).filter((k) => KINDS[k].roles.includes(role));

export const TIME_ZONE = "America/Argentina/Buenos_Aires";
/** Read notices older than this are deleted. */
const KEEP_DAYS = 60;

export type Notice = { kind: Kind; title: string; body: string; href: string; key?: string };
type Options = {
  /** Who caused it: never notified. */
  actorId?: number | null;
  except?: (number | null | undefined)[];
  /** Only these people (still filtered by role, muting and actor). */
  to?: (number | null | undefined)[];
  /**
   * add: always a new notice. replace (default with a key): an unread notice with the same key is
   * rewritten and moved to the top. update: only rewrites unread notices that exist. once: never
   * sent twice to the same person for that key, read or not.
   */
  mode?: "add" | "replace" | "update" | "once";
};

async function recipients(db: Executor, companyId: number, kind: Kind, exclude: Set<number>, to?: number[]) {
  if (to && to.length === 0) return [];
  const us = await db
    .select({ id: users.id, muted: users.mutedNotifications })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.active, true), inArray(users.role, KINDS[kind].roles), to ? inArray(users.id, to) : undefined));
  return us.filter((u) => !exclude.has(u.id) && !u.muted.includes(kind)).map((u) => u.id);
}

/** Sends a notice to everyone whose role acts on it. Returns how many people got it. */
export async function notify(db: Executor, companyId: number, n: Notice, o: Options = {}) {
  const key = n.key ?? null;
  const mode = o.mode ?? (key ? "replace" : "add");
  if (mode === "update") {
    if (!key) return 0;
    const done = await db
      .update(notifications)
      .set({ title: n.title, body: n.body, href: n.href })
      .where(and(eq(notifications.companyId, companyId), eq(notifications.key, key), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return done.length;
  }
  const exclude = new Set([o.actorId, ...(o.except ?? [])].filter((x): x is number => typeof x === "number"));
  if (mode === "once" && key) {
    for (const r of await db.select({ userId: notifications.userId }).from(notifications).where(and(eq(notifications.companyId, companyId), eq(notifications.key, key)))) exclude.add(r.userId);
  }
  const to = o.to?.filter((x): x is number => typeof x === "number");
  const ids = await recipients(db, companyId, n.kind, exclude, to);
  if (ids.length === 0) return 0;
  const rows = ids.map((userId) => ({ companyId, userId, kind: n.kind, title: n.title, body: n.body, href: n.href, key }));
  if (mode === "replace" && key) {
    await db
      .insert(notifications)
      .values(rows)
      .onConflictDoUpdate({
        target: [notifications.userId, notifications.key],
        targetWhere: sql`read_at is null`,
        set: { title: sql`excluded.title`, body: sql`excluded.body`, href: sql`excluded.href`, createdAt: sql`now()` },
      });
  } else {
    await db.insert(notifications).values(rows);
  }
  return ids.length;
}

/** The thing a notice was about was dealt with: unread notices about it disappear. */
export async function resolve(db: Executor, companyId: number, key: string, { prefix = false } = {}) {
  await db
    .delete(notifications)
    .where(and(eq(notifications.companyId, companyId), isNull(notifications.readAt), prefix ? like(notifications.key, `${key.replace(/[%_]/g, "\\$&")}%`) : eq(notifications.key, key)));
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ───────────── Notices raised from more than one place ─────────────

/** Packed orders wait for a supervisor to review them and load them in Fierro: one notice, one current number. */
export async function refreshToLoad(db: Executor, companyId: number, actorId: number | null, mode: "replace" | "update") {
  const [{ n }] = await db.select({ n: count() }).from(orders).where(and(eq(orders.companyId, companyId), eq(orders.status, "packed")));
  if (n === 0) return resolve(db, companyId, "to_load");
  await notify(db, companyId, { kind: "to_load", title: "Pedidos sin cargar en Fierro", body: plural(n, "pedido empacado", "pedidos empacados"), href: "/fierro#cargar", key: "to_load" }, { actorId, mode });
}

/** Units that were not where they should be went to FALTANTES: a count or a write-off is due. */
export async function notifyShortage(db: Executor, companyId: number, actorId: number, d: { order: string; quantity: number; article: string; where: string; key: string }) {
  await notify(db, companyId, { kind: "shortage", title: "Faltante", body: `${d.order} · ${d.quantity} × ${d.article} · ${d.where}`, href: "/bajas", key: d.key }, { actorId, mode: "add" });
}

/** After a sync: new work for the floor, and started orders Fierro changed, for the desk. */
export async function announceSync(db: Executor, companyId: number, actorId: number | null, r: { newOrders: number; newReceipts: number; flaggedOrders: number }) {
  if (r.newOrders > 0 || r.newReceipts > 0) {
    const [[o], [i]] = await Promise.all([
      db.select({ n: count() }).from(orders).where(and(eq(orders.companyId, companyId), eq(orders.status, "pending"))),
      db.select({ n: count() }).from(receivings).where(and(eq(receivings.companyId, companyId), eq(receivings.status, "pending"))),
    ]);
    const parts = [o.n > 0 && plural(o.n, "pedido", "pedidos"), i.n > 0 && plural(i.n, "recepción", "recepciones")].filter(Boolean);
    if (parts.length > 0) {
      await notify(db, companyId, { kind: "new_work", title: "Trabajo nuevo de Fierro", body: `Pendientes: ${parts.join(", ")}`, href: r.newOrders > 0 ? "/picking" : "/recepcion", key: "new_work" }, { actorId });
    }
  }
  if (r.flaggedOrders > 0) {
    const flagged = await db
      .select({ number: orders.number })
      .from(orders)
      .where(and(eq(orders.companyId, companyId), isNotNull(orders.fierroChange), inArray(orders.status, ["in_picking", "to_control", "picked", "packed"])))
      .orderBy(orders.number)
      .limit(4);
    if (flagged.length === 0) return;
    const shown = flagged.slice(0, 3).map((f) => f.number);
    const body = `${plural(r.flaggedOrders, "pedido en curso", "pedidos en curso")}: ${shown.join(", ")}${r.flaggedOrders > shown.length ? "…" : ""}`;
    await notify(db, companyId, { kind: "fierro_changes", title: "Cambios en Fierro", body, href: "/pedidos" }, { actorId });
  }
}

// ───────────── Checks that depend on the clock ─────────────

const lastRun = new Map<number, number>();

/**
 * Notices nobody's action raises: a stalled order, the end of the day. There is no scheduler; this
 * runs whenever someone of the company loads a screen or the bell asks for news, at most once a
 * minute per company per server.
 */
export async function runTimedChecks(db: DB, companyId: number, now = new Date(), { force = false } = {}) {
  if (!force && now.getTime() - (lastRun.get(companyId) ?? 0) < 60_000) return;
  lastRun.set(companyId, now.getTime());
  try {
    await checkStalledPicking(db, companyId, now);
    await checkDayEnd(db, companyId, now);
    await db.delete(notifications).where(and(eq(notifications.companyId, companyId), isNotNull(notifications.readAt), lt(notifications.createdAt, new Date(now.getTime() - KEEP_DAYS * 86_400_000))));
  } catch (e) {
    // A failed check must not take the screen down with it; the next one tries again.
    console.error("Notification checks failed", e);
  }
}

const clock = (d: Date) => new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(d);

async function checkStalledPicking(db: DB, companyId: number, now: Date) {
  // Orders released or finished since: their unread notice no longer holds.
  const open = await db
    .select({ id: notifications.id, key: notifications.key })
    .from(notifications)
    .where(and(eq(notifications.companyId, companyId), isNull(notifications.readAt), like(notifications.key, "stalled_picking:%")));
  if (open.length > 0) {
    const ids = [...new Set(open.map((n) => Number(n.key!.split(":")[1])))];
    const still = new Set((await db.select({ id: orders.id }).from(orders).where(and(inArray(orders.id, ids), eq(orders.status, "in_picking")))).map((o) => o.id));
    const gone = open.filter((n) => !still.has(Number(n.key!.split(":")[1]))).map((n) => n.id);
    if (gone.length > 0) await db.delete(notifications).where(inArray(notifications.id, gone));
  }

  const since = new Date(now.getTime() - STALL_HOURS * 3_600_000);
  const taken = await db
    .select({ id: orders.id, number: orders.number, takenAt: orders.takenAt, picker: users.name })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.takenBy))
    .where(and(eq(orders.companyId, companyId), eq(orders.status, "in_picking"), lt(orders.takenAt, since)));
  if (taken.length === 0) return;
  const lastPick = new Map(
    (
      await db
        .select({ reference: movements.reference, at: sql<string>`max(${movements.createdAt})` })
        .from(movements)
        .where(and(eq(movements.companyId, companyId), eq(movements.reason, "picking"), inArray(movements.reference, taken.map((o) => o.number))))
        .groupBy(movements.reference)
    ).map((m) => [m.reference, new Date(m.at)]),
  );
  for (const o of taken) {
    const last = new Date(Math.max(o.takenAt!.getTime(), lastPick.get(o.number)?.getTime() ?? 0));
    if (last >= since) continue;
    // Keyed by when it was taken: released and taken again, it can stall again.
    await notify(
      db,
      companyId,
      { kind: "stalled_picking", title: "Pedido sin avances", body: `${o.number} · ${o.picker ?? "Sin asignar"} · desde las ${clock(last)}`, href: `/picking/${o.id}`, key: `stalled_picking:${o.id}:${o.takenAt!.getTime()}` },
      { mode: "once" },
    );
  }
}

/** Local date and hour in the warehouse's time zone. */
export function localDay(now: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

async function checkDayEnd(db: DB, companyId: number, now: Date) {
  const { date, hour } = localDay(now);
  if (hour < DAY_END_HOUR) return;
  // Conditional update: with several servers, only one sends it.
  const won = await db
    .update(companies)
    .set({ dayEndOn: date })
    .where(and(eq(companies.id, companyId), or(isNull(companies.dayEndOn), lt(companies.dayEndOn, date))))
    .returning({ id: companies.id });
  if (won.length === 0) return;
  const parts = await openAtDayEnd(db, companyId);
  if (parts.length === 0) return;
  await notify(db, companyId, { kind: "day_end", title: "Pendiente al cierre", body: parts.join(" · "), href: "/", key: `day_end:${date}` }, { mode: "once" });
}

/** What is still open, in the order a supervisor would deal with it before leaving. */
export async function openAtDayEnd(db: DB, companyId: number) {
  const zoneUnits = (types: ("receiving" | "returns" | "missing" | "damaged")[]) =>
    db
      .select({ n: sum(stock.quantity).mapWith(Number) })
      .from(stock)
      .innerJoin(locations, eq(locations.id, stock.locationId))
      .where(and(eq(stock.companyId, companyId), inArray(locations.type, types)))
      .then((r) => r[0].n ?? 0);
  const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0].n);
  const inStatus = (status: "in_picking" | "to_control" | "picked" | "packed") => n(db.select({ n: count() }).from(orders).where(and(eq(orders.companyId, companyId), eq(orders.status, status))));
  const [picking, control, packing, packed, undispatched, receivingsOpen, returnsOpen, countsOpen, toPutAway, held, exports] = await Promise.all([
    inStatus("in_picking"),
    inStatus("to_control"),
    inStatus("picked"),
    inStatus("packed"),
    toDispatch(db, companyId).then((r) => r.length),
    n(db.select({ n: count() }).from(receivings).where(and(eq(receivings.companyId, companyId), eq(receivings.status, "in_progress")))),
    n(db.select({ n: count() }).from(returns).where(and(eq(returns.companyId, companyId), eq(returns.status, "in_progress")))),
    n(db.select({ n: count() }).from(counts).where(and(eq(counts.companyId, companyId), eq(counts.status, "open")))),
    zoneUnits(["receiving", "returns"]),
    zoneUnits(["missing", "damaged"]),
    pendingExports(db, companyId),
  ]);
  const otherDocs = exports.filter((e) => e.type !== "order").length;
  const item = (k: number, one: string, many: string) => k > 0 && plural(k, one, many);
  return [
    item(picking, "pedido en picking", "pedidos en picking"),
    item(control, "pedido por controlar", "pedidos por controlar"),
    item(packing, "pedido por empacar", "pedidos por empacar"),
    item(packed, "pedido sin cargar en Fierro", "pedidos sin cargar en Fierro"),
    item(undispatched, "pedido sin despachar", "pedidos sin despachar"),
    item(otherDocs, "documento sin cargar en Fierro", "documentos sin cargar en Fierro"),
    item(receivingsOpen, "recepción abierta", "recepciones abiertas"),
    item(returnsOpen, "devolución abierta", "devoluciones abiertas"),
    item(toPutAway, "unidad por reponer", "unidades por reponer"),
    item(countsOpen, "conteo abierto", "conteos abiertos"),
    item(held, "unidad en FALTANTES o DANADOS", "unidades en FALTANTES o DANADOS"),
  ].filter((x): x is string => Boolean(x));
}

// ───────────── Reading ─────────────

export type InboxItem = { id: number; kind: string; title: string; body: string; href: string; createdAt: string; read: boolean };

export async function inbox(db: Executor, userId: number, limit = 8): Promise<{ unread: number; items: InboxItem[] }> {
  const [[{ unread }], rows] = await Promise.all([
    db.select({ unread: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit),
  ]);
  return { unread, items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, createdAt: r.createdAt.toISOString(), read: r.readAt != null })) };
}
