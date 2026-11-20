import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { locations, products, transferLines, transfers, users } from "@/db/schema";
import { UserError } from "../errors";
import { findLocation, findProduct, moveStock, zone } from "../stock";
import { nextNumber, validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

/**
 * Stock away from the building that is still owned: a fair stand, books on consignment at a
 * bookstore. It sits in an "outside" location and gets there, and back, only through a transfer
 * (Salida). See "Stock away from the warehouse" in docs/DECISIONS.md.
 */

/** Where stock can be taken from for a transfer: what is on the floor and free. */
const SENDABLE = ["shelf", "clearance", "receiving", "returns"];

/** Turns a name into a location code: "Stand Comic-Con 2026" → "STAND-COMIC-CON-2026". */
export function outsideCode(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20)
    .replace(/-+$/, "");
}

/** A new outside location, created on purpose by a supervisor. Refuses a name whose code exists. */
export async function createOutsideLocation(c: Ctx, name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 3) throw new UserError("TRF-01", "Escribe el nombre del destino.");
  if (clean.length > 60) throw new UserError("TRF-02", "El nombre es demasiado largo.");
  const code = outsideCode(clean);
  if (!code) throw new UserError("TRF-03", "El nombre tiene que tener letras o números.");
  const [created] = await c.db.insert(locations).values({ companyId: c.companyId, code, type: "outside", name: clean }).onConflictDoNothing().returning();
  if (!created) throw new UserError("TRF-04", `Ya existe la ubicación ${code}. Elígela de la lista.`);
  return created;
}

export const outsideLocations = (db: DB, companyId: number) =>
  db.select().from(locations).where(and(eq(locations.companyId, companyId), eq(locations.type, "outside"), eq(locations.active, true))).orderBy(asc(locations.code));

async function transferOf(c: Ctx, id: number) {
  const [t] = await c.db.select().from(transfers).where(and(eq(transfers.id, id), eq(transfers.companyId, c.companyId)));
  if (!t) throw new UserError("TRF-05", "No se encontró esa salida.");
  return t;
}

export async function createTransfer(c: Ctx, locationId: number) {
  const [l] = Number.isInteger(locationId) ? await c.db.select().from(locations).where(and(eq(locations.id, locationId), eq(locations.companyId, c.companyId))) : [];
  if (!l || l.type !== "outside" || !l.active) throw new UserError("TRF-06", "Elige el destino de la lista.");
  const number = await nextNumber(c.db, transfers, transfers.number, eq(transfers.companyId, c.companyId), "SAL-", 4);
  const [t] = await c.db.insert(transfers).values({ companyId: c.companyId, number, locationId: l.id, createdBy: c.userId }).returning();
  return t.id;
}

/** Takes units from a location in the warehouse to the transfer's destination. Only while it is being prepared. */
export async function sendItem(c: Ctx, id: number, d: { source: string; product: string; quantity: unknown }) {
  const n = validQuantity(d.quantity);
  const t = await transferOf(c, id);
  if (t.status !== "sending") throw new UserError("TRF-07", `La salida ${t.number} ya salió del depósito.`);
  const source = await findLocation(c.db, c.companyId, d.source);
  if (!SENDABLE.includes(source.type)) throw new UserError("TRF-08", "De esa ubicación no se sacan artículos para una salida.");
  const p = await findProduct(c.db, c.companyId, d.product);
  return c.db.transaction(async (tx) => {
    await moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: source.id, toId: t.locationId, quantity: n, reason: "transfer_out", reference: t.number, userId: c.userId });
    const [line] = await tx
      .insert(transferLines)
      .values({ transferId: t.id, productId: p.id, sent: n })
      .onConflictDoUpdate({ target: [transferLines.transferId, transferLines.productId], set: { sent: sql`${transferLines.sent} + ${n}` } })
      .returning();
    return `${n} × ${articleName(p.title)} · ${line.sent} en la salida`;
  });
}

/** Takes an article back out of a transfer being prepared: its units go to RECEPCION to be put away. */
export async function unsendItem(c: Ctx, id: number, productId: number) {
  const t = await transferOf(c, id);
  if (t.status !== "sending") throw new UserError("TRF-07", `La salida ${t.number} ya salió del depósito.`);
  const [line] = await c.db.select().from(transferLines).where(and(eq(transferLines.transferId, t.id), eq(transferLines.productId, productId)));
  if (!line) throw new UserError("TRF-09", "Ese artículo no está en la salida.");
  return c.db.transaction(async (tx) => {
    const dock = await zone(tx, c.companyId, "receiving");
    await moveStock(tx, { companyId: c.companyId, productId, fromId: t.locationId, toId: dock.id, quantity: line.sent, reason: "undo", reference: t.number, userId: c.userId });
    await tx.delete(transferLines).where(eq(transferLines.id, line.id));
    return `${line.sent} ${line.sent === 1 ? "unidad vuelve" : "unidades vuelven"} a Recepción para reponer.`;
  });
}

/** The transfer leaves the building, with the remito it travels with (issued in Fierro). */
export async function sendTransfer(c: Ctx, id: number, remito: string) {
  const t = await transferOf(c, id);
  if (t.status !== "sending") throw new UserError("TRF-07", `La salida ${t.number} ya salió del depósito.`);
  const [any] = await c.db.select({ id: transferLines.id }).from(transferLines).where(eq(transferLines.transferId, t.id)).limit(1);
  if (!any) throw new UserError("TRF-10", "La salida no tiene artículos.");
  const clean = remito.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!clean) throw new UserError("TRF-11", "Escribe el número de remito con que viaja.");
  await c.db.update(transfers).set({ status: "away", remitoNumber: clean, sentAt: new Date() }).where(eq(transfers.id, t.id));
  return `${t.number} en camino.`;
}

/** Units that come back from the destination: they enter RECEPCION, to be put away. */
export async function receiveBack(c: Ctx, id: number, d: { product: string; quantity: unknown }) {
  const n = validQuantity(d.quantity);
  const t = await transferOf(c, id);
  if (t.status !== "away") throw new UserError("TRF-12", `La salida ${t.number} no está afuera.`);
  const p = await findProduct(c.db, c.companyId, d.product);
  const [line] = await c.db.select().from(transferLines).where(and(eq(transferLines.transferId, t.id), eq(transferLines.productId, p.id)));
  if (!line) throw new UserError("TRF-13", `"${articleName(p.title)}" no salió con ${t.number}.`);
  const left = line.sent - line.returned - line.sold;
  if (n > left) throw new UserError("TRF-14", `De ${articleName(p.title)} quedan ${left} afuera.`);
  return c.db.transaction(async (tx) => {
    const dock = await zone(tx, c.companyId, "receiving");
    await moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: t.locationId, toId: dock.id, quantity: n, reason: "transfer_back", reference: t.number, userId: c.userId });
    await tx.update(transferLines).set({ returned: line.returned + n }).where(eq(transferLines.id, line.id));
    return `${n} × ${articleName(p.title)} de regreso · quedan ${left - n} afuera`;
  });
}

/**
 * Settles a transfer: what did not come back is recorded as sold at the destination and leaves
 * stock. Supervisors only (the action checks the role).
 */
export async function closeTransfer(c: Ctx, id: number) {
  const t = await transferOf(c, id);
  if (t.status !== "away") throw new UserError("TRF-12", `La salida ${t.number} no está afuera.`);
  return c.db.transaction(async (tx) => {
    const lines = await tx.select().from(transferLines).where(eq(transferLines.transferId, t.id));
    let sold = 0;
    for (const l of lines) {
      const left = l.sent - l.returned - l.sold;
      if (left <= 0) continue;
      await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: t.locationId, toId: null, quantity: left, reason: "sold_outside", reference: t.number, userId: c.userId });
      await tx.update(transferLines).set({ sold: l.sold + left }).where(eq(transferLines.id, l.id));
      sold += left;
    }
    await tx.update(transfers).set({ status: "closed", closedAt: new Date() }).where(eq(transfers.id, t.id));
    return `${t.number} cerrada${sold > 0 ? `: ${sold} ${sold === 1 ? "unidad vendida" : "unidades vendidas"} afuera` : ""}.`;
  });
}

/** The transfers, open ones first, with their destination and totals. */
export async function listTransfers(db: DB, companyId: number) {
  const rows = await db
    .select({
      t: transfers,
      code: locations.code,
      name: locations.name,
      by: users.name,
      sent: sql<number>`coalesce(sum(${transferLines.sent}), 0)`.mapWith(Number),
      returned: sql<number>`coalesce(sum(${transferLines.returned}), 0)`.mapWith(Number),
      sold: sql<number>`coalesce(sum(${transferLines.sold}), 0)`.mapWith(Number),
    })
    .from(transfers)
    .innerJoin(locations, eq(locations.id, transfers.locationId))
    .innerJoin(users, eq(users.id, transfers.createdBy))
    .leftJoin(transferLines, eq(transferLines.transferId, transfers.id))
    .where(eq(transfers.companyId, companyId))
    .groupBy(transfers.id, locations.code, locations.name, users.name)
    .orderBy(sql`${transfers.status} = 'closed'`, desc(transfers.createdAt))
    .limit(200);
  return rows;
}

export async function transferLinesOf(db: DB, transferId: number) {
  return db
    .select({ l: transferLines, title: products.title, barcode: products.barcode, sku: products.internalCode, isbn: products.isbn })
    .from(transferLines)
    .innerJoin(products, eq(products.id, transferLines.productId))
    .where(eq(transferLines.transferId, transferId))
    .orderBy(asc(products.title));
}

