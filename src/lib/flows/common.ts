import type { DB } from "@/db";
import { UserError } from "../errors";

export type Ctx = { db: DB; companyId: number; userId: number };

export function validQuantity(v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 100000) throw new UserError("STK-10", "La cantidad tiene que ser un número entero mayor que cero.");
  return n;
}
