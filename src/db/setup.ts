/**
 * Prepares the database: creates or updates the tables and, if it is empty, loads the demo data.
 * Usage: npm run db:setup   |   npm run db:reset (deletes everything and starts again)
 */
import { rmSync } from "node:fs";
import { sql } from "drizzle-orm";
import { connect, runMigrations } from "./index";
import { companies } from "./schema";
import { seed } from "./seed";

async function main() {
  const reset = process.argv.includes("--reset");
  if (process.env.DATABASE_URL && !process.env.SECRET) {
    throw new Error("[CFG-02] The SECRET variable is missing. It is required when DATABASE_URL is set. Generate one with: openssl rand -hex 32");
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
  console.log(`Database ready (${embedded ? "embedded in ./.data" : "Postgres"}).`);
  await close();
}

main().catch((e) => {
  // CFG-02 above already carries its code; anything else (migration, connection) gets CLI-05.
  if (e instanceof Error && e.message.startsWith("[CFG-02]")) console.error(e.message);
  else console.error("[CLI-05] Database setup failed:", e);
  process.exit(1);
});
