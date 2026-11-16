import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type DB = PgDatabase<any, typeof schema>;
/** Sirve tanto para la base como para una transacción abierta. */
export type Ejecutor = Pick<DB, "select" | "insert" | "update" | "delete" | "execute">;

type Conexion = { db: DB; cerrar: () => Promise<void>; embebida: boolean };
const g = globalThis as { __midepo?: Promise<Conexion> };

/**
 * Con DATABASE_URL usa Postgres (producción). Sin ella usa PGlite, un Postgres embebido
 * que guarda todo en ./.data: no hay que instalar nada para probar miDepo en una máquina.
 */
async function abrir(): Promise<Conexion> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 5 });
    return { db: drizzle(pool, { schema }) as unknown as DB, cerrar: () => pool.end(), embebida: false };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const carpeta = process.env.PGLITE_DIR ?? ".data/pglite";
  if (!carpeta.startsWith("memory://")) (await import("node:fs")).mkdirSync(carpeta, { recursive: true });
  const cliente = new PGlite(carpeta);
  await cliente.waitReady;
  return { db: drizzle(cliente, { schema }) as unknown as DB, cerrar: () => cliente.close(), embebida: true };
}

export function conexion() {
  return (g.__midepo ??= abrir());
}

export async function getDb(): Promise<DB> {
  return (await conexion()).db;
}

export async function migrar() {
  const { db, embebida } = await conexion();
  const carpeta = { migrationsFolder: "drizzle" };
  if (embebida) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as any, carpeta);
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as any, carpeta);
  }
}

export { schema };
