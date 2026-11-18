/**
 * Prepara la base: crea o actualiza las tablas y, si está vacía, carga los datos de demostración.
 * Uso: npm run db:setup   |   npm run db:reset (borra todo y vuelve a empezar)
 */
import { rmSync } from "node:fs";
import { sql } from "drizzle-orm";
import { conexion, migrar } from "./index";
import { empresas } from "./schema";
import { asignarReservas } from "@/lib/reservas";
import { sembrar } from "./seed";

async function main() {
  const reset = process.argv.includes("--reset");
  if (process.env.DATABASE_URL && !process.env.SECRETO) {
    throw new Error("Falta la variable SECRETO. Es obligatoria cuando hay DATABASE_URL. Generá una con: openssl rand -hex 32");
  }
  if (reset && !process.env.DATABASE_URL) rmSync(process.env.PGLITE_DIR ?? ".data/pglite", { recursive: true, force: true });
  const { db, cerrar, embebida } = await conexion();
  if (reset && !embebida) {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;`);
  }
  await migrar();
  const [hay] = await db.select({ id: empresas.id }).from(empresas).limit(1);
  if (!hay && (process.env.DATOS_DEMO ?? "si") !== "no") {
    const inicio = Date.now();
    await sembrar(db, (m) => console.log("  " + m));
    console.log(`Datos de demostración cargados en ${((Date.now() - inicio) / 1000).toFixed(1)} s.`);
  }
  // Pedidos que ya estaban pendientes antes de existir las reservas apartan lo que haya (no cambia nada si ya está al día).
  for (const e of await db.select({ id: empresas.id }).from(empresas)) await db.transaction((tx) => asignarReservas(tx, e.id));
  console.log(`Base lista (${embebida ? "embebida en ./.data" : "Postgres"}).`);
  await cerrar();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
