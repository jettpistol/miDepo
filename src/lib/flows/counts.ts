import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { countLines, countLocations, counts, products, stock, locations } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, moveStock } from "../stock";
import { validQuantity, type Ctx } from "./common";

export const MAX_COUNT_LOCATIONS = 300;

/** Creates a count for every shelf whose code starts with the given prefix. */
export async function createCount(c: Ctx, name: string, prefix: string) {
  const pre = prefix.trim().toUpperCase();
  if (!name.trim()) throw new UserError("CNT-01", "Ponle un nombre al conteo (por ejemplo: Pasillo A, noviembre).");
  if (!pre) throw new UserError("CNT-02", "Escribe con qué empiezan las ubicaciones a contar (por ejemplo: A-01).");
  const us = await c.db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.companyId, c.companyId), eq(locations.type, "shelf"), eq(locations.active, true), like(locations.code, `${pre.replace(/[%_]/g, "")}%`)))
    .orderBy(asc(locations.code))
    .limit(MAX_COUNT_LOCATIONS + 1);
  if (us.length === 0) throw new UserError("CNT-03", `No hay ubicaciones que empiecen con "${pre}".`);
  if (us.length > MAX_COUNT_LOCATIONS) throw new UserError("CNT-04", `Son más de ${MAX_COUNT_LOCATIONS} ubicaciones. Parte el conteo en tramos más chicos.`);
  return c.db.transaction(async (tx) => {
    const [stockCount] = await tx.insert(counts).values({ companyId: c.companyId, name: name.trim() }).returning();
    await tx.insert(countLocations).values(us.map((u) => ({ countId: stockCount.id, locationId: u.id })));
    return stockCount.id;
  });
}

async function isOpen(c: Ctx, countId: number) {
  const [k] = await c.db.select().from(counts).where(and(eq(counts.id, countId), eq(counts.companyId, c.companyId)));
  if (!k) throw new UserError("CNT-05", "No encuentro ese conteo.");
  if (k.status === "closed") throw new UserError("CNT-06", "Este conteo ya está cerrado.");
  return k;
}

async function countLocation(c: Ctx, countId: number, locationId: number) {
  const [u] = await c.db.select().from(countLocations).where(and(eq(countLocations.countId, countId), eq(countLocations.locationId, locationId)));
  if (!u) throw new UserError("CNT-07", "Esa ubicación no es parte de este conteo.");
  return u;
}

/** Blind count: the operator does not see what the system says, they only add what they find. */
export async function scanCount(c: Ctx, countId: number, locationId: number, code: string, quantity: unknown) {
  const n = validQuantity(quantity);
  await isOpen(c, countId);
  const u = await countLocation(c, countId, locationId);
  if (u.status === "counted") throw new UserError("CNT-08", "Esta ubicación ya se dio por contada.");
  const p = await findProduct(c.db, c.companyId, code);
  const [l] = await c.db
    .insert(countLines)
    .values({ countId, locationId, productId: p.id, countedQty: n })
    .onConflictDoUpdate({ target: [countLines.countId, countLines.locationId, countLines.productId], set: { countedQty: sql`${countLines.countedQty} + ${n}` } })
    .returning();
  return `${p.title}: llevas ${l.countedQty}`;
}

export async function setCounted(c: Ctx, countId: number, locationId: number, productId: number, countedQty: unknown) {
  const n = Number(countedQty);
  if (!Number.isInteger(n) || n < 0) throw new UserError("CNT-09", "Escribe un número de cero para arriba.");
  await isOpen(c, countId);
  await c.db.update(countLines).set({ countedQty: n }).where(and(eq(countLines.countId, countId), eq(countLines.locationId, locationId), eq(countLines.productId, productId)));
  return "Cantidad corregida.";
}

export async function markLocation(c: Ctx, countId: number, locationId: number, counted: boolean) {
  await isOpen(c, countId);
  await countLocation(c, countId, locationId);
  await c.db
    .update(countLocations)
    .set({ status: counted ? "counted" : "pending", countedBy: counted ? c.userId : null })
    .where(and(eq(countLocations.countId, countId), eq(countLocations.locationId, locationId)));
  return counted ? "Ubicación contada." : "Ubicación reabierta.";
}

export type Difference = { locationId: number; location: string; productId: number; title: string; code: string; system: number; countedQty: number };

/** Compares what was counted with stock, only in locations already marked as counted. */
export async function differences(db: Executor, countId: number): Promise<Difference[]> {
  const countedCount = (await db.select({ id: countLocations.locationId }).from(countLocations).where(and(eq(countLocations.countId, countId), eq(countLocations.status, "counted")))).map((u) => u.id);
  if (countedCount.length === 0) return [];
  const inSystem = await db.select().from(stock).where(inArray(stock.locationId, countedCount));
  const countedQty = await db.select().from(countLines).where(and(eq(countLines.countId, countId), inArray(countLines.locationId, countedCount)));
  const lookupMap = new Map<string, { locationId: number; productId: number; system: number; countedQty: number }>();
  for (const s of inSystem) lookupMap.set(`${s.locationId}:${s.productId}`, { locationId: s.locationId, productId: s.productId, system: s.quantity, countedQty: 0 });
  for (const l of countedQty) {
    const k = `${l.locationId}:${l.productId}`;
    lookupMap.set(k, { locationId: l.locationId, productId: l.productId, system: lookupMap.get(k)?.system ?? 0, countedQty: l.countedQty });
  }
  const rows = [...lookupMap.values()];
  if (rows.length === 0) return [];
  const us = new Map((await db.select({ id: locations.id, code: locations.code }).from(locations).where(inArray(locations.id, countedCount))).map((u) => [u.id, u.code]));
  const ps = new Map(
    (await db.select({ id: products.id, title: products.title, isbn: products.isbn, internal: products.internalCode }).from(products).where(inArray(products.id, [...new Set(rows.map((f) => f.productId))]))).map((p) => [p.id, p]),
  );
  return rows
    .map((f) => ({ ...f, location: us.get(f.locationId) ?? "?", title: ps.get(f.productId)?.title ?? "?", code: ps.get(f.productId)?.isbn ?? ps.get(f.productId)?.internal ?? "" }))
    .sort((a, b) => a.location.localeCompare(b.location) || a.title.localeCompare(b.title));
}

/** The supervisor approves: the stock of the counted locations becomes what was counted. */
export async function closeCount(c: Ctx, countId: number) {
  const k = await isOpen(c, countId);
  return c.db.transaction(async (tx) => {
    const diffs = await differences(tx, countId);
    const [counted] = await tx.select().from(countLocations).where(and(eq(countLocations.countId, countId), eq(countLocations.status, "counted"))).limit(1);
    if (!counted) throw new UserError("CNT-10", "Todavía no hay ninguna ubicación contada.");
    let adjustments = 0;
    for (const d of diffs) {
      await tx
        .insert(countLines)
        .values({ countId, locationId: d.locationId, productId: d.productId, countedQty: d.countedQty, system: d.system })
        .onConflictDoUpdate({ target: [countLines.countId, countLines.locationId, countLines.productId], set: { system: d.system } });
      const delta = d.countedQty - d.system;
      if (delta === 0) continue;
      adjustments++;
      await moveStock(tx, { companyId: c.companyId, productId: d.productId, fromId: delta < 0 ? d.locationId : null, toId: delta > 0 ? d.locationId : null, quantity: Math.abs(delta), reason: "count_adjustment", reference: k.name, userId: c.userId });
    }
    // Locations left uncounted are removed from the count: they are not adjusted.
    await tx.delete(countLocations).where(and(eq(countLocations.countId, countId), eq(countLocations.status, "pending")));
    await tx.update(counts).set({ status: "closed" }).where(eq(counts.id, countId));
    return adjustments === 0 ? "Conteo cerrado. Todo coincidía." : `Conteo cerrado con ${adjustments} ajuste${adjustments === 1 ? "" : "s"} de stock.`;
  });
}
