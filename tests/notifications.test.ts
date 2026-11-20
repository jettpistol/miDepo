import { beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq, isNull } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { companies, locations, notifications, orderLines, orders, products, receivingLines, receivings, users } from "@/db/schema";
import { createCompany, createUser } from "@/db/seed";
import { sync } from "@/lib/fierro";
import { moveStock, zone } from "@/lib/stock";
import type { Ctx } from "@/lib/flows/common";
import { markShort, takeOrder } from "@/lib/flows/picking";
import { closeReceiving, scanReceiving } from "@/lib/flows/receiving";
import { closeCount, createCount, markLocation, requestRecount, scanCount } from "@/lib/flows/counts";
import { writeOff } from "@/lib/flows/adjustments";
import { simulateNews } from "@/lib/flows/exports";
import { assign } from "@/lib/flows/assignments";
import { setUrgent } from "@/lib/flows/orders";
import { addComment } from "@/lib/flows/comments";
import { announceSync, DAY_END_HOUR, kindsFor, localDay, refreshToLoad, runTimedChecks } from "@/lib/notifications";

let db: DB;
let company: typeof companies.$inferSelect;
let admin: number, sup: number, op1: number, op2: number;
const as = (userId: number): Ctx => ({ db, companyId: company.id, userId });

/** Unread notices of one person, of one kind. */
const unread = (userId: number, kind: string) =>
  db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.kind, kind), isNull(notifications.readAt))).orderBy(asc(notifications.id));

beforeAll(async () => {
  await runMigrations();
  db = await getDb();
  const base = await createCompany(db, { name: "Avisos SA", slug: "avisos" });
  [company] = await db.update(companies).set({ simSeed: 7, simTitles: 40, simCustomers: 5, simOrders: 4, simReceipts: 1 }).where(eq(companies.id, base.id)).returning();
  const user = async (name: string, role: "admin" | "supervisor" | "operator") => (await createUser(db, company.id, { name, email: `${name}@avisos.test`, role, password: "long-password" })).id;
  admin = await user("admin", "admin");
  sup = await user("supervisor", "supervisor");
  op1 = await user("operario1", "operator");
  op2 = await user("operario2", "operator");
  await db.insert(locations).values(["A-01-1", "A-01-2", "B-01-1", "B-01-2"].map((code) => ({ companyId: company.id, code })));
  await sync(db, company);
});

const shelf = async (code: string) => (await db.select().from(locations).where(and(eq(locations.companyId, company.id), eq(locations.code, code))))[0];

describe("notifications", () => {
  it("each role gets only its kinds", () => {
    expect(kindsFor("operator")).toEqual(["assigned", "urgent", "recount", "comment", "new_work"]);
    expect(kindsFor("admin")).toContain("write_off");
    expect(kindsFor("supervisor")).not.toContain("write_off");
  });

  it("a picking shortage tells the desk, not the picker nor other operators, and respects muting", async () => {
    const [order] = await db.select().from(orders).where(and(eq(orders.companyId, company.id), eq(orders.status, "pending"))).orderBy(asc(orders.id)).limit(1);
    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
    const a = await shelf("A-01-1");
    for (const l of lines) await moveStock(db, { companyId: company.id, productId: l.productId, fromId: null, toId: a.id, quantity: l.quantity, reason: "initial" });
    await db.update(users).set({ mutedNotifications: ["shortage"] }).where(eq(users.id, admin));

    await takeOrder(as(op1), order.id);
    const [task] = await db.query.pickTasks.findMany({ where: (t, { eq }) => eq(t.orderId, order.id), limit: 1 });
    await markShort(as(op1), task.id);

    const [n] = await unread(sup, "shortage");
    expect(n.body).toMatch(new RegExp(`^${order.number} · \\d+ × [^a-z]+ · A-01-1$`));
    expect(n.href).toBe("/bajas");
    expect(await unread(admin, "shortage")).toHaveLength(0); // muted
    expect(await unread(op1, "shortage")).toHaveLength(0); // the actor
    expect(await unread(op2, "shortage")).toHaveLength(0); // not their role
  });

  it("administrators hear of write-offs", async () => {
    const missing = await zone(db, company.id, "missing");
    const [held] = await db.query.stock.findMany({ where: (s, { eq }) => eq(s.locationId, missing.id), limit: 1 });
    await writeOff(as(sup), { locationId: missing.id, productId: held.productId, quantity: 1, cause: "theft_or_loss" });
    const [n] = await unread(admin, "write_off");
    expect(n.body).toMatch(/^AJ-\d+ · 1 × .+ · FALTANTES · Robo o extravío · supervisor$/);
    expect(await unread(sup, "write_off")).toHaveLength(0);
  });

  it("packed orders to document are one notice that keeps its number current and goes away when none are left", async () => {
    const pending = await db.select().from(orders).where(and(eq(orders.companyId, company.id), eq(orders.status, "pending"))).orderBy(asc(orders.id)).limit(2);
    await db.update(orders).set({ status: "packed" }).where(eq(orders.id, pending[0].id));
    await refreshToLoad(db, company.id, op1, "replace");
    await db.update(orders).set({ status: "packed" }).where(eq(orders.id, pending[1].id));
    await refreshToLoad(db, company.id, op2, "replace");
    let ns = await unread(sup, "to_load");
    expect(ns).toHaveLength(1);
    expect(ns[0].body).toBe("2 pedidos empacados");

    await db.update(orders).set({ status: "shipped" }).where(eq(orders.id, pending[0].id));
    await refreshToLoad(db, company.id, sup, "update");
    ns = await unread(sup, "to_load");
    expect(ns[0].body).toBe("1 pedido empacado");

    await db.update(orders).set({ status: "shipped" }).where(eq(orders.id, pending[1].id));
    await refreshToLoad(db, company.id, sup, "update");
    expect(await unread(sup, "to_load")).toHaveLength(0);
  });

  it("a count is announced when its last shelf is counted; a recount goes to someone else and the notices follow the count", async () => {
    const countId = await createCount(as(sup), "Pasillo B", "B-01");
    const a1 = await shelf("B-01-1");
    const a2 = await shelf("B-01-2");
    const [p] = await db.select().from(products).where(eq(products.companyId, company.id)).limit(1);
    await scanCount(as(op1), countId, a2.id, p.barcode, 6); // 6 more than the system: needs a recount
    await markLocation(as(op1), countId, a1.id, true);
    expect(await unread(sup, "count_ready")).toHaveLength(0); // one shelf still pending
    await markLocation(as(op1), countId, a2.id, true);
    const [ready] = await unread(sup, "count_ready");
    expect(ready.body).toBe("Pasillo B · 1 ubicación con diferencias · 1 para recontar");

    await requestRecount(as(sup), countId, a2.id);
    expect(await unread(sup, "count_ready")).toHaveLength(0);
    expect(await unread(op1, "recount")).toHaveLength(0); // counted first
    const [recount] = await unread(op2, "recount");
    expect(recount.body).toContain("B-01-2");

    await scanCount(as(op2), countId, a2.id, p.barcode, 6);
    await markLocation(as(op2), countId, a2.id, true);
    expect(await unread(op2, "recount")).toHaveLength(0);
    expect(await unread(sup, "count_ready")).toHaveLength(1);

    await closeCount(as(sup), countId);
    expect(await unread(sup, "count_ready")).toHaveLength(0);
    expect(await unread(admin, "count_ready")).toHaveLength(0);
  });

  it("an announced receiving closed with differences tells the desk; one that matches tells nobody", async () => {
    const [rec] = await db.select().from(receivings).where(and(eq(receivings.companyId, company.id), eq(receivings.status, "pending"))).limit(1);
    const lines = await db.select().from(receivingLines).where(eq(receivingLines.receivingId, rec.id));
    const ps = new Map((await db.select().from(products).where(eq(products.companyId, company.id))).map((p) => [p.id, p]));
    for (const l of lines.slice(1)) await scanReceiving(as(op1), rec.id, ps.get(l.productId)!.barcode, l.expected);
    await scanReceiving(as(op1), rec.id, ps.get(lines[0].productId)!.barcode, lines[0].expected + 2);
    await closeReceiving(as(op1), rec.id);
    const [n] = await unread(sup, "receiving_differences");
    expect(n.body).toMatch(new RegExp(`^${rec.number} · .+ · 2 de más$`));
    expect(n.href).toBe(`/recepcion/${rec.id}`);
  });

  it("new work from Fierro reaches the floor in one notice per sync", async () => {
    await simulateNews(db, company, "orders", 3, sup);
    const ns = await unread(op1, "new_work");
    expect(ns).toHaveLength(1);
    expect(ns[0].body).toMatch(/^Pendientes: \d+ pedidos$/);
    expect(await unread(sup, "new_work")).toHaveLength(0);
    await simulateNews(db, company, "orders", 1, sup);
    expect(await unread(op1, "new_work")).toHaveLength(1);
  });

  it("a started order that Fierro changed is reported to the desk", async () => {
    const [o] = await db.select().from(orders).where(and(eq(orders.companyId, company.id), eq(orders.status, "in_picking"))).limit(1);
    await db.update(orders).set({ fierroChange: "changed" }).where(eq(orders.id, o.id));
    await announceSync(db, company.id, null, { newOrders: 0, newReceipts: 0, flaggedOrders: 1 });
    const [n] = await unread(sup, "fierro_changes");
    expect(n.body).toBe(`1 pedido en curso: ${o.number}`);
    expect(await unread(op1, "fierro_changes")).toHaveLength(0);
    await db.update(orders).set({ fierroChange: null }).where(eq(orders.id, o.id));
  });

  it("an order with no picks for 2 hours is reported once", async () => {
    const [order] = await db.select().from(orders).where(and(eq(orders.companyId, company.id), eq(orders.status, "in_picking"))).limit(1);
    const now = new Date();
    await db.update(orders).set({ takenAt: new Date(now.getTime() - 3 * 3_600_000) }).where(eq(orders.id, order.id));
    await runTimedChecks(db, company.id, now, { force: true });
    await runTimedChecks(db, company.id, now, { force: true });
    const ns = await unread(sup, "stalled_picking");
    expect(ns).toHaveLength(1);
    expect(ns[0].body).toContain(order.number);
    expect(ns[0].body).toContain("operario1");
  });

  it("assigning work tells the assignee only; marking an order urgent tells whoever has it", async () => {
    const [o] = await db.select().from(orders).where(and(eq(orders.companyId, company.id), eq(orders.status, "pending"))).orderBy(asc(orders.id)).limit(1);
    await assign(as(sup), "order", o.id, op2);
    const [n] = await unread(op2, "assigned");
    expect(n.body).toBe(`${o.number} · supervisor`);
    expect(n.href).toBe(`/picking/${o.id}`);
    expect(await unread(op1, "assigned")).toHaveLength(0);
    await assign(as(op2), "order", o.id, op2); // to oneself: nothing
    expect(await unread(op2, "assigned")).toHaveLength(1);

    await setUrgent(as(sup), o.id, true);
    expect(await unread(op2, "urgent")).toHaveLength(1);
    expect(await unread(op1, "urgent")).toHaveLength(0);
    await setUrgent(as(sup), o.id, true); // already urgent: no second notice
    expect(await unread(op2, "urgent")).toHaveLength(1);
  });

  it("a comment reaches whoever has the order; a reply reaches the thread", async () => {
    const [o] = await db.select().from(orders).where(and(eq(orders.companyId, company.id), eq(orders.status, "pending"), eq(orders.assignedTo, op2))).limit(1);
    const top = await addComment(as(sup), { subjectType: "order", subjectId: o.id, body: "Revisar   la dirección antes de empacar" });
    const [n] = await unread(op2, "comment");
    expect(n.title).toBe("Comentario");
    expect(n.body).toBe(`${o.number} · supervisor: Revisar la dirección antes de empacar`);
    expect(await unread(op1, "comment")).toHaveLength(0);
    await addComment(as(op1), { subjectType: "order", subjectId: o.id, body: "Ya está", parentId: top.id });
    const replies = (await unread(sup, "comment")).filter((r) => r.title === "Respuesta");
    expect(replies).toHaveLength(1);
    expect(await unread(op1, "comment")).toHaveLength(0); // the author of the reply
  });

  it("the end-of-day notice goes out once a day, from the closing hour, listing what is open", async () => {
    // 20:30 UTC is 17:30 in Buenos Aires.
    const day = new Date("2026-11-20T20:30:00Z");
    expect(localDay(day)).toEqual({ date: "2026-11-20", hour: DAY_END_HOUR });
    await runTimedChecks(db, company.id, new Date("2026-11-20T18:00:00Z"), { force: true });
    expect(await unread(sup, "day_end")).toHaveLength(0); // 15:00 there
    await runTimedChecks(db, company.id, day, { force: true });
    await runTimedChecks(db, company.id, new Date("2026-11-20T22:00:00Z"), { force: true });
    const ns = await unread(sup, "day_end");
    expect(ns).toHaveLength(1);
    expect(ns[0].body).toContain("en picking");
    expect(ns[0].body).toContain("unidades por reponer");
    await runTimedChecks(db, company.id, new Date("2026-11-21T20:30:00Z"), { force: true });
    expect(await unread(sup, "day_end")).toHaveLength(2);
  });
});
