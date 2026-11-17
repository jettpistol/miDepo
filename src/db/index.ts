import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type DB = PgDatabase<any, typeof schema>;
/** Works for both the database and an open transaction. */
export type Executor = Pick<DB, "select" | "insert" | "update" | "delete" | "execute">;

type Connection = { db: DB; close: () => Promise<void>; embedded: boolean };
const g = globalThis as { __midepo?: Promise<Connection> };

/**
 * With DATABASE_URL it uses Postgres (production). Without it, it uses PGlite, an embedded Postgres
 * that keeps everything in ./.data: nothing to install to try miDepo on a machine.
 */
async function openUp(): Promise<Connection> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 5 });
    return { db: drizzle(pool, { schema }) as unknown as DB, close: () => pool.end(), embedded: false };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const folder = process.env.PGLITE_DIR ?? ".data/pglite";
  if (!folder.startsWith("memory://")) (await import("node:fs")).mkdirSync(folder, { recursive: true });
  const customer = new PGlite(folder);
  await customer.waitReady;
  return { db: drizzle(customer, { schema }) as unknown as DB, close: () => customer.close(), embedded: true };
}

export function connect() {
  return (g.__midepo ??= openUp());
}

export async function getDb(): Promise<DB> {
  return (await connect()).db;
}

export async function runMigrations() {
  const { db, embedded } = await connect();
  const folder = { migrationsFolder: "drizzle" };
  if (embedded) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as any, folder);
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as any, folder);
  }
}

export { schema };
