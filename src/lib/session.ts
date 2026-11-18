import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, sessions, users, type Role } from "@/db/schema";
import { hashToken, newToken } from "./credentials";
import { UserError } from "./errors";

/**
 * A device can have several accounts open at once. `ACTIVE` holds the session in use
 * and `ALL` the full list; switching account is just picking another from the list.
 */
const ACTIVE = "midepo_session";
const ALL = "midepo_sessions";
const DAYS = 30;
export const MAX_ACCOUNTS = 5;

type Jar = Awaited<ReturnType<typeof cookies>>;
const options = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: DAYS * 86400 });

function save(jar: Jar, tokens: string[], active: string | undefined) {
  if (tokens.length === 0 || !active) {
    jar.delete(ACTIVE);
    jar.delete(ALL);
    return;
  }
  jar.set(ACTIVE, active, options());
  jar.set(ALL, tokens.join("."), options());
}

/** Live sessions on this device, with their token. For internal use in this module only. */
const openList = cache(async () => {
  const jar = await cookies();
  const active = jar.get(ACTIVE)?.value;
  const tokens = [...new Set([active, ...(jar.get(ALL)?.value.split(".") ?? [])].filter((t): t is string => Boolean(t)))].slice(0, MAX_ACCOUNTS + 1);
  if (tokens.length === 0) return [];
  const db = await getDb();
  const rows = await db
    .select({ tokenHash: sessions.tokenHash, user: users, company: companies })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(companies, eq(companies.id, users.companyId))
    .where(and(inArray(sessions.tokenHash, tokens.map(hashToken)), gt(sessions.expiresAt, new Date()), eq(users.active, true)));
  const byHash = new Map(rows.map((f) => [f.tokenHash, f]));
  return tokens.flatMap((token) => {
    const f = byHash.get(hashToken(token));
    return f ? [{ token, user: f.user, company: f.company, active: token === active }] : [];
  });
});

/** Accounts open on this device, without secrets: for showing the switcher. */
export async function openAccounts() {
  return (await openList()).map(({ user, company, active }) => ({ user, company, active }));
}

/** User and company of the account in use, or null. Computed once per request. */
export const currentSession = cache(async () => {
  const s = (await openList()).find((a) => a.active);
  return s ? { user: s.user, company: s.company } : null;
});

/** Opens a session and makes it the one in use. The device's other accounts stay open. */
export async function startSession(userId: number, hours = DAYS * 24) {
  const db = await getDb();
  const previous = await openList();
  const token = newToken();
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + hours * 3600_000) });
  // If that person already had a session here, the new one replaces it; and never more than MAX_ACCOUNTS.
  const stillThere = previous.filter((p) => p.user.id !== userId).slice(0, MAX_ACCOUNTS - 1);
  const surplus = previous.filter((p) => !stillThere.includes(p));
  if (surplus.length > 0) await db.delete(sessions).where(inArray(sessions.tokenHash, surplus.map((s) => hashToken(s.token))));
  save(await cookies(), [token, ...stillThere.map((s) => s.token)], token);
}

/** Switches to another account that is already open on this device. */
export async function switchToAccount(userId: number) {
  const all = await openList();
  const destination = all.find((s) => s.user.id === userId);
  if (!destination) return false;
  save(await cookies(), all.map((s) => s.token), destination.token);
  return true;
}

/** Logs out of the account in use (or all of them). If another stays open, switches to it. Returns whether any is left. */
export async function endSession(allAccounts = false) {
  const all = await openList();
  const closing = allAccounts ? all : all.filter((s) => s.active);
  const stillThere = all.filter((s) => !closing.includes(s));
  if (closing.length > 0) await (await getDb()).delete(sessions).where(inArray(sessions.tokenHash, closing.map((s) => hashToken(s.token))));
  save(await cookies(), stillThere.map((s) => s.token), stillThere[0]?.token);
  return stillThere.length > 0;
}

const LEVEL: Record<Role, number> = { operator: 1, supervisor: 2, admin: 3 };
export const can = (role: Role, minRole: Role) => LEVEL[role] >= LEVEL[minRole];

/** For pages: without a session, sends to login; without permission, to the home screen. */
export async function requireSession(minRole: Role = "operator") {
  const s = await currentSession();
  if (!s) redirect("/ingresar");
  if (!can(s.user.role, minRole)) redirect("/");
  return { ...s, db: await getDb() };
}

/** For actions: same as requireSession, but lacking permission is a message, not a redirect. */
export async function requireSessionInAction(minRole: Role = "operator") {
  const s = await currentSession();
  if (!s) redirect("/ingresar");
  if (!can(s.user.role, minRole)) throw new UserError("Tu usuario no tiene permiso para hacer esto.");
  return { ...s, db: await getDb() };
}
