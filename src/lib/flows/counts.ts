import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { countLines, countLocations, counts, products, stock, locations, type AdjustmentCause } from "@/db/schema";
import { UserError } from "../errors";
import { findProduct, moveStock, zone } from "../stock";
import { isLossCause, recordAdjustment, type AdjustmentLine } from "./adjustments";
import { validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

export const MAX_COUNT_LOCATIONS = 300;

/**
 * A difference this large needs a second person to count the shelf again before approval:
 * 5 units or more, or 20% or more of what the system says (from 2 units, so one book on a small
 * shelf does not trigger it). Units, not money: prices change too fast to be a rule.
 */
export const RECOUNT_UNITS = 5;
export const RECOUNT_SHARE = 0.2;
export function needsRecount(system: number, counted: number) {
  const d = Math.abs(counted - system);
  return d >= RECOUNT_UNITS || (d >= 2 && d >= RECOUNT_SHARE * system);
}

/** Creates a count for every shelf whose code starts with the given prefix. */
export async function createCount(c: Ctx, name: string, prefix: string) {
  const pre = prefix.trim().toUpperCase();
  if (!name.trim()) throw new UserError("CNT-01", "Escribe un nombre para el conteo (por ejemplo: Pasillo A, noviembre).");
  if (!pre) throw new UserError("CNT-02", "Escribe con qué empiezan las ubicaciones a contar (por ejemplo: A-01).");
  const us = await c.db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.companyId, c.companyId), eq(locations.type, "shelf"), eq(locations.active, true), like(locations.code, `${pre.replace(/[%_]/g, "")}%`)))
    .orderBy(asc(locations.code))
    .limit(MAX_COUNT_LOCATIONS + 1);
  if (us.length === 0) throw new UserError("CNT-03", `No hay ubicaciones que empiecen con "${pre}".`);
  if (us.length > MAX_COUNT_LOCATIONS) throw new UserError("CNT-04", `Son más de ${MAX_COUNT_LOCATIONS} ubicaciones. Divide el conteo en tramos más pequeños.`);
  return c.db.transaction(async (tx) => {
    const [stockCount] = await tx.insert(counts).values({ companyId: c.companyId, name: name.trim() }).returning();
    await tx.insert(countLocations).values(us.map((u) => ({ countId: stockCount.id, locationId: u.id })));
    return stockCount.id;
  });
}

async function isOpen(c: Ctx, countId: number) {
  const [k] = await c.db.select().from(counts).where(and(eq(counts.id, countId), eq(counts.companyId, c.companyId)));
  if (!k) throw new UserError("CNT-05", "No se encontró ese conteo.");
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
  if (u.firstCountedBy === c.userId) throw new UserError("CNT-12", "Este recuento lo tiene que hacer otra persona.");
  const p = await findProduct(c.db, c.companyId, code);
  const [l] = await c.db
    .insert(countLines)
    .values({ countId, locationId, productId: p.id, countedQty: n })
    .onConflictDoUpdate({ target: [countLines.countId, countLines.locationId, countLines.productId], set: { countedQty: sql`${countLines.countedQty} + ${n}` } })
    .returning();
  return `${articleName(p.title)}: llevas ${l.countedQty}`;
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
  const u = await countLocation(c, countId, locationId);
  if (counted && u.firstCountedBy === c.userId) throw new UserError("CNT-12", "Este recuento lo tiene que hacer otra persona.");
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

/**
 * Supervisor asks for a shelf to be counted again. What was counted there is cleared (the count
 * stays blind) and whoever counted first cannot do the recount.
 */
export async function requestRecount(c: Ctx, countId: number, locationId: number) {
  await isOpen(c, countId);
  const u = await countLocation(c, countId, locationId);
  if (u.status !== "counted" || !u.countedBy) throw new UserError("CNT-13", "Esa ubicación todavía no se contó.");
  await c.db.transaction(async (tx) => {
    await tx.delete(countLines).where(and(eq(countLines.countId, countId), eq(countLines.locationId, locationId)));
    await tx.update(countLocations).set({ status: "pending", firstCountedBy: u.countedBy, countedBy: null }).where(and(eq(countLocations.countId, countId), eq(countLocations.locationId, locationId)));
  });
  return "Recuento pedido. Lo tiene que hacer otra persona.";
}

export type CountPlan = {
  /** Short on one shelf, over on another: moved, not lost. */
  relocations: { productId: number; fromId: number; toId: number; quantity: number }[];
  /** More than the system said, with no shortage of that title in this count. */
  found: { productId: number; locationId: number; quantity: number }[];
  /** Less than the system said, with no surplus of that title in this count. */
  losses: { productId: number; locationId: number; quantity: number }[];
};

/** Splits a count's differences into misplacements, finds and losses, title by title. */
export function planCount(diffs: Pick<Difference, "productId" | "locationId" | "system" | "countedQty">[]): CountPlan {
  const plan: CountPlan = { relocations: [], found: [], losses: [] };
  const byProduct = new Map<number, typeof diffs>();
  for (const d of diffs) if (d.countedQty !== d.system) byProduct.set(d.productId, [...(byProduct.get(d.productId) ?? []), d]);
  for (const [productId, ds] of byProduct) {
    const short = ds.filter((d) => d.countedQty < d.system).map((d) => ({ locationId: d.locationId, n: d.system - d.countedQty }));
    const over = ds.filter((d) => d.countedQty > d.system).map((d) => ({ locationId: d.locationId, n: d.countedQty - d.system }));
    for (const o of over) {
      for (const sh of short) {
        const n = Math.min(o.n, sh.n);
        if (n === 0) continue;
        plan.relocations.push({ productId, fromId: sh.locationId, toId: o.locationId, quantity: n });
        o.n -= n;
        sh.n -= n;
      }
      if (o.n > 0) plan.found.push({ productId, locationId: o.locationId, quantity: o.n });
    }
    for (const sh of short) if (sh.n > 0) plan.losses.push({ productId, locationId: sh.locationId, quantity: sh.n });
  }
  return plan;
}

/** Locations with a large difference that nobody has recounted yet: approval waits for them. */
export async function awaitingRecount(db: Executor, countId: number, diffs: Difference[]) {
  const recounted = new Set(
    (await db.select({ id: countLocations.locationId }).from(countLocations).where(and(eq(countLocations.countId, countId), sql`${countLocations.firstCountedBy} is not null`))).map((r) => r.id),
  );
  return new Set(diffs.filter((d) => needsRecount(d.system, d.countedQty) && !recounted.has(d.locationId)).map((d) => d.locationId));
}

/**
 * The supervisor approves. Misplaced units move between the counted shelves; units found come out
 * of FALTANTES first and otherwise enter as found; units still short are written off with `cause`.
 * Finds and losses become one adjustment document, which reaches Fierro with the count.
 */
export async function closeCount(c: Ctx, countId: number, cause: string = "count_difference") {
  const k = await isOpen(c, countId);
  if (!isLossCause(cause)) throw new UserError("CNT-14", "Elige el motivo de lo que falta.");
  return c.db.transaction(async (tx) => {
    const diffs = await differences(tx, countId);
    const [counted] = await tx.select().from(countLocations).where(and(eq(countLocations.countId, countId), eq(countLocations.status, "counted"))).limit(1);
    if (!counted) throw new UserError("CNT-10", "Todavía no hay ninguna ubicación contada.");
    if ((await awaitingRecount(tx, countId, diffs)).size > 0) throw new UserError("CNT-11", "Hay diferencias grandes sin recontar. Pide el recuento antes de aprobar.");
    for (const d of diffs) {
      await tx
        .insert(countLines)
        .values({ countId, locationId: d.locationId, productId: d.productId, countedQty: d.countedQty, system: d.system })
        .onConflictDoUpdate({ target: [countLines.countId, countLines.locationId, countLines.productId], set: { system: d.system } });
    }
    const plan = planCount(diffs);
    const move = (productId: number, fromId: number | null, toId: number | null, quantity: number, reason: "count_relocation" | "found" | "write_off") =>
      moveStock(tx, { companyId: c.companyId, productId, fromId, toId, quantity, reason, reference: k.name, userId: c.userId });

    for (const r of plan.relocations) await move(r.productId, r.fromId, r.toId, r.quantity, "count_relocation");
    const lines: AdjustmentLine[] = [];
    const missing = plan.found.length > 0 ? await zone(tx, c.companyId, "missing") : null;
    for (const f of plan.found) {
      // Units a picker reported missing that turn up here were never written off: they just come back.
      const [held] = await tx.select({ n: stock.quantity }).from(stock).where(and(eq(stock.productId, f.productId), eq(stock.locationId, missing!.id)));
      const back = Math.min(held?.n ?? 0, f.quantity);
      if (back > 0) await move(f.productId, missing!.id, f.locationId, back, "found");
      if (f.quantity > back) {
        await move(f.productId, null, f.locationId, f.quantity - back, "found");
        lines.push({ productId: f.productId, locationId: f.locationId, quantity: f.quantity - back, cause: "found" });
      }
    }
    for (const l of plan.losses) {
      await move(l.productId, l.locationId, null, l.quantity, "write_off");
      lines.push({ productId: l.productId, locationId: l.locationId, quantity: -l.quantity, cause: cause as AdjustmentCause });
    }
    if (lines.length > 0) await recordAdjustment(tx, c, lines, countId);

    // Locations left uncounted are removed from the count: they are not adjusted.
    await tx.delete(countLocations).where(and(eq(countLocations.countId, countId), eq(countLocations.status, "pending")));
    await tx.update(counts).set({ status: "closed" }).where(eq(counts.id, countId));
    const units = (xs: { quantity: number }[]) => xs.reduce((s, x) => s + x.quantity, 0);
    const parts = [
      plan.relocations.length && `${units(plan.relocations)} mal ubicados`,
      plan.found.length && `${units(plan.found)} aparecieron`,
      plan.losses.length && `${units(plan.losses)} dados de baja`,
    ].filter(Boolean);
    return parts.length === 0 ? "Conteo cerrado. Todo coincidía." : `Conteo cerrado: ${parts.join(", ")}.`;
  });
}
