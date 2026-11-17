"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, loginAttempts, users } from "@/db/schema";
import { VALID_PIN, pinHmac, verifyPassword } from "@/lib/credentials";
import { UserError, attempt, type Result } from "@/lib/errors";
import { switchToAccount, endSession, startSession } from "@/lib/session";

const MAX = 6;
const LOCK_MINUTES = 5;

/** Slows down repeated attempts: after several failures in a row you have to wait a few minutes. */
async function withRateLimit<T>(key: string, attemptFn: () => Promise<T | null>): Promise<T> {
  const db = await getDb();
  const [i] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
  if (i?.lockedUntil && i.lockedUntil > new Date()) throw new UserError(`Demasiados intentos. Esperá ${LOCK_MINUTES} minutos y probá de nuevo.`);
  const result = await attemptFn();
  if (result) {
    await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
    return result;
  }
  const attempts = (i?.lockedUntil ? 0 : (i?.attempts ?? 0)) + 1;
  const lockedUntil = attempts >= MAX ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
  await db.insert(loginAttempts).values({ key, attempts, lockedUntil }).onConflictDoUpdate({ target: loginAttempts.key, set: { attempts, lockedUntil } });
  throw new UserError("Los datos no coinciden. Revisalos y probá de nuevo.");
}

const source = async () => (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";

export async function loginWithPassword(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    const email = String(f.get("email") ?? "").toLowerCase().trim();
    const password = String(f.get("password") ?? "");
    if (!email || !password) throw new UserError("Completá el email y la contraseña.");
    const user = await withRateLimit(`password:${email}`, async () => {
      const [u] = await (await getDb()).select().from(users).where(and(eq(users.email, email), eq(users.active, true)));
      return u && verifyPassword(password, u.passwordHash) ? u : null;
    });
    await startSession(user.id);
    redirect("/");
  });
}

export async function loginWithPin(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    const slug = String(f.get("company") ?? "").toLowerCase().trim();
    const pin = String(f.get("pin") ?? "").trim();
    if (!slug) throw new UserError("Escribí el código de tu empresa. Te lo da tu supervisor.");
    if (!VALID_PIN.test(pin)) throw new UserError("El PIN tiene 6 números.");
    const user = await withRateLimit(`pin:${slug}:${await source()}`, async () => {
      const db = await getDb();
      const [e] = await db.select().from(companies).where(eq(companies.slug, slug));
      if (!e) return null;
      const [u] = await db.select().from(users).where(and(eq(users.companyId, e.id), eq(users.pinHmac, pinHmac(e.id, pin)), eq(users.active, true)));
      return u ?? null;
    });
    // A PIN session lasts one long shift: the next day you have to log in again.
    await startSession(user.id, 14);
    redirect("/");
  });
}

/** Logs out of the account in use. If another one is open on the device, it carries on with that one. */
export async function logout() {
  redirect((await endSession()) ? "/" : "/ingresar");
}

export async function logoutAll() {
  await endSession(true);
  redirect("/ingresar");
}

export async function switchAccount(f: FormData) {
  redirect((await switchToAccount(Number(f.get("userId")))) ? "/" : "/ingresar");
}
