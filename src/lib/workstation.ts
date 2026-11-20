import { cookies, headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { workstations } from "@/db/schema";
import { newToken } from "./credentials";

/**
 * This computer (browser), per company: a long-lived cookie names it, so its printer for each
 * kind of label can be chosen once. Pages only read it; actions create it on first use.
 */
const COOKIE = "midepo_equipo";
const YEARS = 3;

export async function workstationToken() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/** This computer's row for the company, or null if it never printed or was set up here. */
export async function currentWorkstation(db: DB, companyId: number) {
  const token = await workstationToken();
  if (!token) return null;
  const [w] = await db.select().from(workstations).where(and(eq(workstations.companyId, companyId), eq(workstations.token, token)));
  return w ?? null;
}

/** "Chrome · Windows", from the browser's user agent. */
export function describeAgent(ua: string) {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const system = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
  return system ? `${browser} · ${system}` : browser;
}

/** For actions: this computer's row, created (and the cookie set) if missing. Records who used it last. */
export async function ensureWorkstation(db: DB, companyId: number, userId: number) {
  const jar = await cookies();
  let token = jar.get(COOKIE)?.value;
  if (!token) {
    token = newToken();
    jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: YEARS * 365 * 86400 });
  }
  const agent = describeAgent((await headers()).get("user-agent") ?? "");
  const [found] = await db.select().from(workstations).where(and(eq(workstations.companyId, companyId), eq(workstations.token, token)));
  if (found) {
    const [w] = await db.update(workstations).set({ lastSeenAt: new Date(), lastUserId: userId, agent }).where(eq(workstations.id, found.id)).returning();
    return w;
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(workstations).where(eq(workstations.companyId, companyId));
  const [w] = await db.insert(workstations).values({ companyId, token, name: `Equipo ${n + 1}`, agent, lastUserId: userId }).returning();
  return w;
}
