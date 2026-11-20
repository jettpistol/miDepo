import { and, count, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { adjustmentLines, adjustments, locations, movements, products, stock, users, type AdjustmentCause } from "@/db/schema";
import { UserError } from "../errors";
import { moveStock } from "../stock";
import { validQuantity, type Ctx } from "./common";

/**
 * Stock that changes with nobody on the other side: losses, damage, stock that turns up.
 * Every such change is an adjustment document with a cause per line and the supervisor who
 * approved it; that document is what Fierro is told. See docs/DECISIONS.md (D19 to D22).
 */

export const CAUSES: { id: AdjustmentCause; name: string }[] = [
  { id: "count_difference", name: "Diferencia de conteo" },
  { id: "theft_or_loss", name: "Robo o extravío" },
  { id: "damage", name: "Rotura o daño" },
  { id: "entry_error", name: "Error de carga" },
  { id: "internal_use", name: "Uso interno o muestra" },
  { id: "found", name: "Apareció" },
];
/** Causes a loss can be given (everything except "found"). */
export const LOSS_CAUSES = CAUSES.filter((c) => c.id !== "found");
export const causeName = (id: string) => CAUSES.find((c) => c.id === id)?.name ?? id;
export const isLossCause = (v: string): v is AdjustmentCause => LOSS_CAUSES.some((c) => c.id === v);

/** The zones whose stock a supervisor can write off directly, with the cause offered first. */
export const WRITE_OFF_ZONES = { missing: "theft_or_loss", damaged: "damage" } as const;

export type AdjustmentLine = { productId: number; locationId: number; quantity: number; cause: AdjustmentCause };

/** Records an adjustment document. The stock movements are made by the caller. */
export async function recordAdjustment(tx: Executor, c: Ctx, lines: AdjustmentLine[], countId: number | null = null) {
  const [{ n }] = await tx.select({ n: count() }).from(adjustments).where(eq(adjustments.companyId, c.companyId));
  const number = `AJ-${String(n + 1).padStart(5, "0")}`;
  const [a] = await tx.insert(adjustments).values({ companyId: c.companyId, number, countId, approvedBy: c.userId }).returning();
  if (lines.length > 0) await tx.insert(adjustmentLines).values(lines.map((l) => ({ adjustmentId: a.id, ...l })));
  return a;
}

/** Writes off units held in FALTANTES or DANADOS: they leave the warehouse with a cause. */
export async function writeOff(c: Ctx, d: { locationId: number; productId: number; quantity: unknown; cause: string }) {
  const n = validQuantity(d.quantity);
  const [u] = await c.db.select().from(locations).where(and(eq(locations.id, d.locationId), eq(locations.companyId, c.companyId)));
  if (!u || !(u.type in WRITE_OFF_ZONES)) throw new UserError("ADJ-01", "Solo se da de baja lo que está en Faltantes o en Dañados.");
  if (!isLossCause(d.cause)) throw new UserError("ADJ-02", "Elige el motivo de la baja.");
  const [p] = await c.db.select().from(products).where(and(eq(products.id, d.productId), eq(products.companyId, c.companyId)));
  if (!p) throw new UserError("ADJ-03", "Ese artículo no está en el catálogo.");
  return c.db.transaction(async (tx) => {
    const a = await recordAdjustment(tx, c, [{ productId: p.id, locationId: u.id, quantity: -n, cause: d.cause as AdjustmentCause }]);
    await moveStock(tx, { companyId: c.companyId, productId: p.id, fromId: u.id, toId: null, quantity: n, reason: "write_off", reference: a.number, userId: c.userId });
    return `${a.number}: ${n} × ${p.title} dado de baja (${causeName(d.cause).toLowerCase()}).`;
  });
}

/** What sits in FALTANTES and DANADOS, waiting for a supervisor. */
export async function heldStock(db: DB, companyId: number) {
  return db
    .select({ locationId: locations.id, zone: locations.type, productId: products.id, title: products.title, code: products.barcode, quantity: stock.quantity })
    .from(stock)
    .innerJoin(locations, eq(locations.id, stock.locationId))
    .innerJoin(products, eq(products.id, stock.productId))
    .where(and(eq(stock.companyId, companyId), inArray(locations.type, ["missing", "damaged"]), gte(stock.quantity, 1)))
    .orderBy(products.title);
}

/** Every adjustment line since a date, newest first, for the history and the totals by cause. */
export async function adjustmentHistory(db: DB, companyId: number, since: Date) {
  return db
    .select({
      id: adjustmentLines.id,
      date: adjustments.createdAt,
      number: adjustments.number,
      countId: adjustments.countId,
      title: products.title,
      location: locations.code,
      quantity: adjustmentLines.quantity,
      cause: adjustmentLines.cause,
      approvedBy: users.name,
    })
    .from(adjustmentLines)
    .innerJoin(adjustments, eq(adjustments.id, adjustmentLines.adjustmentId))
    .innerJoin(products, eq(products.id, adjustmentLines.productId))
    .innerJoin(locations, eq(locations.id, adjustmentLines.locationId))
    .innerJoin(users, eq(users.id, adjustments.approvedBy))
    .where(and(eq(adjustments.companyId, companyId), gte(adjustments.createdAt, since)))
    .orderBy(desc(adjustments.createdAt), desc(adjustmentLines.id));
}

/** Units that counts found on the wrong shelf since a date: moved, not lost. */
export async function misplacedSince(db: DB, companyId: number, since: Date) {
  const rows = await db
    .select({ quantity: movements.quantity })
    .from(movements)
    .where(and(eq(movements.companyId, companyId), eq(movements.reason, "count_relocation"), gte(movements.createdAt, since)));
  return rows.reduce((s, r) => s + r.quantity, 0);
}

/** Adjustments that are not part of a count and Fierro has not been told about. */
export const unsentAdjustments = (db: DB, companyId: number) =>
  db.select().from(adjustments).where(and(eq(adjustments.companyId, companyId), isNull(adjustments.countId), isNull(adjustments.sentToFierro)));
