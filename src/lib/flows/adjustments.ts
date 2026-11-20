import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { adjustmentLines, adjustments, locations, movements, products, stock, users, type AdjustmentCause } from "@/db/schema";
import { UserError } from "../errors";
import { moveStock } from "../stock";
import { nextNumber, validQuantity, type Ctx } from "./common";
import { articleName } from "@/lib/article";

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
  const number = await nextNumber(tx, adjustments, adjustments.number, eq(adjustments.companyId, c.companyId), "AJ-", 5);
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
    return `${a.number}: ${n} × ${articleName(p.title)} dado de baja (${causeName(d.cause).toLowerCase()}).`;
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
      adjustmentId: adjustments.id,
      sent: adjustments.sentToFierro,
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

/**
 * Undoes a write-off from Bajas while Fierro has not been told: the units go back to the zone
 * they left and the adjustment document is deleted. Adjustments made by a count cannot be undone
 * here: they belong to the count.
 */
export async function undoWriteOff(c: Ctx, adjustmentId: number) {
  const [a] = await c.db.select().from(adjustments).where(and(eq(adjustments.id, adjustmentId), eq(adjustments.companyId, c.companyId)));
  if (!a) throw new UserError("ADJ-04", "No se encontró esa baja.");
  if (a.countId != null) throw new UserError("ADJ-05", "Ese ajuste es parte de un conteo aprobado y no se puede deshacer.");
  if (a.sentToFierro) throw new UserError("ADJ-06", "Esa baja ya se cargó en Fierro. No se puede deshacer.");
  return c.db.transaction(async (tx) => {
    for (const l of await tx.select().from(adjustmentLines).where(eq(adjustmentLines.adjustmentId, a.id))) {
      if (l.quantity < 0) await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: null, toId: l.locationId, quantity: -l.quantity, reason: "undo", reference: a.number, userId: c.userId });
      else await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: l.locationId, toId: null, quantity: l.quantity, reason: "undo", reference: a.number, userId: c.userId });
    }
    await tx.delete(adjustments).where(eq(adjustments.id, a.id));
    return `${a.number} deshecha: las unidades volvieron a su zona.`;
  });
}
