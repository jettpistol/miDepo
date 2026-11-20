import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { DB, Executor } from "@/db";
import { UserError } from "../errors";

export type Ctx = { db: DB; companyId: number; userId: number };

export function validQuantity(v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 100000) throw new UserError("STK-10", "La cantidad tiene que ser un número entero mayor que cero.");
  return n;
}

/**
 * The next document number (`REC-0004`): one more than the highest in use, not the row count,
 * so that a cancelled document never makes two share a number.
 */
export async function nextNumber(tx: Executor, table: PgTable, column: AnyPgColumn, where: SQL | undefined, prefix: string, width: number) {
  const pattern = `^${prefix}[0-9]+$`;
  const [{ n }] = await tx
    .select({ n: sql<number>`coalesce(max(cast(substring(${column} from ${prefix.length + 1}::int) as integer)), 0)`.mapWith(Number) })
    .from(table)
    .where(where ? sql`${where} and ${column} ~ ${pattern}` : sql`${column} ~ ${pattern}`);
  return `${prefix}${String(n + 1).padStart(width, "0")}`;
}
