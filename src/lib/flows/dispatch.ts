import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import { boxes, carriers, customers, orders } from "@/db/schema";
import { distance, plain } from "../text";
import { UserError } from "../errors";
import { cleanScan, fixLayout } from "../scan";
import type { Ctx } from "./common";

/**
 * Dispatch: what leaves the dock, on which vehicle, with which papers. A packed order gets its
 * carrier, tracking number and remito number; each of its boxes is scanned onto the vehicle by
 * the code on its label (`PED-00012-C2`). When the last box is scanned the order is dispatched.
 * Stock still leaves when the order is marked as loaded in Fierro (D4); dispatch records the
 * physical departure. See "Dispatch" in docs/DECISIONS.md.
 */

/** Orders that can be dispatched: packed, whether or not Fierro was told yet. */
const DISPATCHABLE = ["packed", "shipped"] as const;

async function orderOf(c: Ctx, orderId: number) {
  const [o] = await c.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.companyId, c.companyId)));
  if (!o) throw new UserError("DSP-01", "No se encontró ese pedido.");
  return o;
}

/** Adds a carrier on purpose. Like suppliers, refuses names that already exist or are one or two letters off. */
export async function createCarrier(c: Ctx, name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 2) throw new UserError("DSP-02", "Escribe el nombre del transporte.");
  if (clean.length > 60) throw new UserError("DSP-03", "El nombre es demasiado largo.");
  const existing = await c.db.select({ id: carriers.id, name: carriers.name }).from(carriers).where(eq(carriers.companyId, c.companyId));
  const same = existing.find((s) => plain(s.name) === plain(clean));
  if (same) throw new UserError("DSP-04", `Ya existe: ${same.name}. Elígelo de la lista.`);
  const near = existing.find((s) => Math.min(plain(s.name).length, plain(clean).length) >= 5 && distance(plain(s.name), plain(clean)) <= 2);
  if (near) throw new UserError("DSP-05", `¿Es ${near.name}? Ya existe un transporte casi igual. Elígelo de la lista.`);
  const [created] = await c.db.insert(carriers).values({ companyId: c.companyId, name: clean, createdBy: c.userId }).returning({ id: carriers.id, name: carriers.name });
  return created;
}

export const listCarriers = (db: DB, companyId: number) => db.select({ id: carriers.id, name: carriers.name }).from(carriers).where(eq(carriers.companyId, companyId)).orderBy(asc(carriers.name));

/** Who carries the order and the papers it travels with. Editable until it is dispatched. */
export async function setShipping(c: Ctx, orderId: number, d: { carrierId: number; tracking: string; remito: string }) {
  const o = await orderOf(c, orderId);
  if (!(DISPATCHABLE as readonly string[]).includes(o.status)) throw new UserError("DSP-06", `El pedido ${o.number} todavía no está empacado.`);
  if (o.dispatchedAt) throw new UserError("DSP-07", `El pedido ${o.number} ya salió. Para cambiar estos datos, descarga una caja.`);
  const [carrier] = Number.isInteger(d.carrierId) ? await c.db.select().from(carriers).where(and(eq(carriers.id, d.carrierId), eq(carriers.companyId, c.companyId))) : [];
  if (!carrier) throw new UserError("DSP-08", "Elige el transporte de la lista.");
  const tidy = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, 60) || null;
  await c.db.update(orders).set({ carrierId: carrier.id, trackingNumber: tidy(d.tracking), remitoNumber: tidy(d.remito) }).where(eq(orders.id, o.id));
  return `Pedido ${o.number}: ${carrier.name}.`;
}

/** Reads a box label ("PED-00012-C2") into the order number and the box number. */
export function parseBoxCode(code: string) {
  const m = fixLayout(cleanScan(code).toUpperCase()).match(/^(.+)-C(\d+)$/);
  return m ? { orderNumber: m[1], boxNumber: Number(m[2]) } : null;
}

/** The box a label belongs to, with its order: what the scan form checks as you type, and loadBox uses. */
export async function boxByCode(db: DB, companyId: number, code: string) {
  const parsed = parseBoxCode(code);
  if (!parsed) return null;
  const [row] = await db
    .select({ box: boxes, order: orders, customer: customers.name })
    .from(boxes)
    .innerJoin(orders, eq(orders.id, boxes.orderId))
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(and(eq(orders.companyId, companyId), eq(orders.number, parsed.orderNumber), eq(boxes.number, parsed.boxNumber)));
  return row ?? null;
}

/** Why a box cannot be loaded, or null if it can. The scan form shows the same reason before the click. */
export function cannotLoad(row: NonNullable<Awaited<ReturnType<typeof boxByCode>>>) {
  if (!(DISPATCHABLE as readonly string[]).includes(row.order.status)) return `El pedido ${row.order.number} todavía no está empacado.`;
  if (row.box.status !== "closed") return `La caja ${row.box.number} todavía está abierta.`;
  if (row.box.loadedAt) return `La caja ${row.box.number} del pedido ${row.order.number} ya se cargó.`;
  if (!row.order.carrierId) return `Falta el transporte del pedido ${row.order.number}.`;
  return null;
}

/** Scans a box onto the vehicle. When it is the order's last one, the order is dispatched. */
export async function loadBox(c: Ctx, code: string) {
  if (!code.trim()) throw new UserError("DSP-09", "Escanea la etiqueta de la caja.");
  const row = await boxByCode(c.db, c.companyId, code);
  if (!row) throw new UserError("DSP-10", `"${code.trim()}" no es la etiqueta de una caja.`);
  const why = cannotLoad(row);
  if (why) throw new UserError("DSP-11", why);
  return c.db.transaction(async (tx) => {
    const now = new Date();
    const done = await tx.update(boxes).set({ loadedAt: now, loadedBy: c.userId }).where(and(eq(boxes.id, row.box.id), isNull(boxes.loadedAt))).returning({ id: boxes.id });
    if (done.length === 0) throw new UserError("DSP-11", `La caja ${row.box.number} del pedido ${row.order.number} ya se cargó.`);
    const all = await tx.select({ loadedAt: boxes.loadedAt }).from(boxes).where(eq(boxes.orderId, row.order.id));
    const loaded = all.filter((b) => b.loadedAt).length;
    if (loaded === all.length) {
      await tx.update(orders).set({ dispatchedAt: now, dispatchedBy: c.userId }).where(eq(orders.id, row.order.id));
      return `Pedido ${row.order.number} despachado.`;
    }
    return `${row.order.number} · caja ${row.box.number} cargada · ${loaded} de ${all.length}`;
  });
}

/** Takes a box back off the vehicle (scanned by mistake). The order is no longer dispatched. */
export async function unloadBox(c: Ctx, boxId: number) {
  const [row] = await c.db.select({ box: boxes, order: orders }).from(boxes).innerJoin(orders, eq(orders.id, boxes.orderId)).where(and(eq(boxes.id, boxId), eq(orders.companyId, c.companyId)));
  if (!row) throw new UserError("DSP-12", "No se encontró esa caja.");
  if (!row.box.loadedAt) throw new UserError("DSP-13", `La caja ${row.box.number} no está cargada.`);
  await c.db.transaction(async (tx) => {
    await tx.update(boxes).set({ loadedAt: null, loadedBy: null }).where(eq(boxes.id, boxId));
    await tx.update(orders).set({ dispatchedAt: null, dispatchedBy: null }).where(eq(orders.id, row.order.id));
  });
  return `${row.order.number} · caja ${row.box.number} descargada.`;
}

/** Packed orders not dispatched yet, oldest first and urgent on top, with their boxes. */
export async function toDispatch(db: DB, companyId: number) {
  const rows = await db
    .select({ o: orders, customer: customers.name, city: customers.city, carrier: carriers.name })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(carriers, eq(carriers.id, orders.carrierId))
    .where(and(eq(orders.companyId, companyId), inArray(orders.status, [...DISPATCHABLE]), isNull(orders.dispatchedAt)))
    .orderBy(asc(orders.date))
    .limit(300);
  const ids = rows.map((r) => r.o.id);
  const bx = ids.length ? await db.select({ orderId: boxes.orderId, loadedAt: boxes.loadedAt }).from(boxes).where(inArray(boxes.orderId, ids)) : [];
  return rows
    .map((r) => {
      const mine = bx.filter((b) => b.orderId === r.o.id);
      return { ...r, boxes: mine.length, loaded: mine.filter((b) => b.loadedAt).length };
    })
    .sort((a, b) => Number(b.o.urgent) - Number(a.o.urgent));
}
