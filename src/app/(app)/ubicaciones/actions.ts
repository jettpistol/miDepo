"use server";

import { and, eq } from "drizzle-orm";
import { action, num, txt } from "@/lib/action";
import { companies, stock, locations } from "@/db/schema";
import { UserError } from "@/lib/errors";
import { generateCodes, validateScheme, type Scheme } from "@/lib/locations";

export const generate = action("supervisor", async (c, f) => {
  let scheme: Scheme;
  try {
    scheme = JSON.parse(txt(f, "scheme"));
  } catch {
    throw new UserError("LOC-01", "No se pudo leer el esquema. Recarga la página y prueba de nuevo.");
  }
  const problem = validateScheme(scheme);
  if (problem) throw new UserError(problem.code, problem.message);
  const codes = generateCodes(scheme);
  let newOnes = 0;
  await c.db.transaction(async (tx) => {
    for (let i = 0; i < codes.length; i += 1000) {
      const createdList = await tx.insert(locations).values(codes.slice(i, i + 1000).map((code) => ({ companyId: c.companyId, code }))).onConflictDoNothing().returning({ id: locations.id });
      newOnes += createdList.length;
    }
    await tx.update(companies).set({ locationScheme: scheme }).where(eq(companies.id, c.companyId));
  });
  const repeated = codes.length - newOnes;
  return `Se crearon ${newOnes} ubicaciones${repeated ? ` (${repeated} ya existían y no se tocaron)` : ""}. Ya puedes imprimir las etiquetas.`;
});

export const createStandalone = action("supervisor", async (c, f) => {
  const code = txt(f, "code").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,19}$/.test(code)) throw new UserError("LOC-02", "El código admite letras, números, guiones y puntos (hasta 20 caracteres, sin espacios ni Ñ).");
  const created = await c.db.insert(locations).values({ companyId: c.companyId, code }).onConflictDoNothing().returning();
  if (created.length === 0) throw new UserError("LOC-03", `La ubicación ${code} ya existe.`);
  return `Ubicación ${code} creada.`;
});

export const toggle = action("supervisor", async (c, f) => {
  const [u] = await c.db.select().from(locations).where(and(eq(locations.id, num(f, "id")), eq(locations.companyId, c.companyId)));
  if (!u || u.type !== "shelf") throw new UserError("LOC-04", "Esa ubicación no se puede dar de baja.");
  if (u.active) {
    const [remains] = await c.db.select().from(stock).where(eq(stock.locationId, u.id)).limit(1);
    if (remains) throw new UserError("LOC-05", "Todavía hay libros en esta ubicación. Muévelos antes de darla de baja.");
  }
  await c.db.update(locations).set({ active: !u.active }).where(eq(locations.id, u.id));
  return u.active ? `${u.code} dada de baja.` : `${u.code} activa de nuevo.`;
});
