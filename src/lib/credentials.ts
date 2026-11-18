import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function secret() {
  if (process.env.SECRET) return process.env.SECRET;
  // With a real database the default secret is not allowed: anyone could compute the PINs.
  if (process.env.DATABASE_URL) throw new Error("[CFG-01] Falta la variable SECRET. Genera una con: openssl rand -hex 32");
  return "local-testing-only";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, putaway: string | null) {
  if (!putaway) return false;
  const [, salt, hash] = putaway.split("$");
  if (!salt || !hash) return false;
  const a = scryptSync(password, salt, 32);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The PIN identifies the operator within their company, which is why the hash is deterministic. */
export function pinHmac(companyId: number, pin: string) {
  return createHmac("sha256", secret()).update(`${companyId}:${pin}`).digest("hex");
}

export const VALID_PIN = /^\d{6}$/;
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const sign = (text: string) => createHmac("sha256", secret()).update(text).digest("base64url");
