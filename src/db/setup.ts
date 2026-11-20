/**
 * Prepares the database: creates or updates the tables and, if it is empty, loads the demo data.
 * Usage: npm run db:setup   |   npm run db:reset (deletes everything and starts again)
 */
import { rmSync } from "node:fs";
import { sql } from "drizzle-orm";
import { connect, runMigrations } from "./index";
import { companies } from "./schema";
import { seed } from "./seed";
import { makeThumbnails } from "@/lib/covers";

async function main() {
  const reset = process.argv.includes("--reset");
  if (process.env.DATABASE_URL && !process.env.SECRET) {
    throw new Error("[CFG-02] Falta la variable SECRET. Es obligatoria cuando está DATABASE_URL. Genera una con: openssl rand -hex 32");
  }
  if (reset && !process.env.DATABASE_URL) rmSync(process.env.PGLITE_DIR ?? ".data/pglite", { recursive: true, force: true });
  const { db, close, embedded } = await connect();
  if (reset && !embedded) {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;`);
  }
  await runMigrations();
  const [present] = await db.select({ id: companies.id }).from(companies).limit(1);
  if (!present && (process.env.DEMO_DATA ?? "yes") !== "no") {
    const startedAt = Date.now();
    await seed(db, (m) => console.log("  " + m));
    console.log(`Demo data loaded in ${((Date.now() - startedAt) / 1000).toFixed(1)} s.`);
  }
  // Thumbnails missing from databases made before list covers existed, or whose cover changed.
  for (const c of await db.select({ id: companies.id }).from(companies)) {
    const r = await makeThumbnails(db, c.id);
    if (r.made > 0 || r.failed > 0) console.log(`  Portadas para listas: ${r.made} hechas${r.failed > 0 ? `, ${r.failed} no se pudieron leer` : ""}.`);
  }
  console.log(`Database ready (${embedded ? "embedded in ./.data" : "Postgres"}).`);
  await close();
}

main().catch((e) => {
  // CFG-02 above already carries its code; anything else (migration, connection) gets CLI-05.
  if (e instanceof Error && e.message.startsWith("[CFG-02]")) console.error(e.message);
  else console.error("[CLI-05] No se pudo preparar la base de datos:", e);
  process.exit(1);
});
