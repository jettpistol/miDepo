"use server";

import { and, eq } from "drizzle-orm";
import { action, num, txt } from "@/lib/action";
import { companies, stock, locations } from "@/db/schema";
import { UserError } from "@/lib/errors";
import { generateCodes, validateScheme, type Scheme } from "@/lib/locations";
import { locationLabels, prepareLabels } from "@/lib/flows/labels";

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
  const created: string[] = [];
  await c.db.transaction(async (tx) => {
    for (let i = 0; i < codes.length; i += 1000) {
      const createdList = await tx.insert(locations).values(codes.slice(i, i + 1000).map((code) => ({ companyId: c.companyId, code }))).onConflictDoNothing().returning({ code: locations.code });
      created.push(...createdList.map((r) => r.code));
    }
    await tx.update(companies).set({ locationScheme: scheme }).where(eq(companies.id, c.companyId));
    // Labels for the new locations, ready in Etiquetas.
    await prepareLabels(tx, c, { kind: "location", reference: created.length === 1 ? created[0] : `${created[0]} … ${created.at(-1)}`, source: "locations", labels: locationLabels(created) });
  });
  const repeated = codes.length - created.length;
  return `${created.length} ubicaciones creadas${repeated ? ` (${repeated} ya existían)` : ""}${created.length ? ". Etiquetas pendientes" : ""}.`;
});

export const createStandalone = action("supervisor", async (c, f) => {
  const code = txt(f, "code").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,19}$/.test(code)) throw new UserError("LOC-02", "El código admite letras, números, guiones y puntos (hasta 20 caracteres, sin espacios ni Ñ).");
  const created = await c.db.insert(locations).values({ companyId: c.companyId, code }).onConflictDoNothing().returning();
  if (created.length === 0) throw new UserError("LOC-03", `La ubicación ${code} ya existe.`);
  await prepareLabels(c.db, c, { kind: "location", reference: code, source: "locations", labels: locationLabels([code]) });
  return `Ubicación ${code} creada. Etiqueta pendiente.`;
});

export const toggle = action("supervisor", async (c, f) => {
  const [u] = await c.db.select().from(locations).where(and(eq(locations.id, num(f, "id")), eq(locations.companyId, c.companyId)));
  if (!u || u.type !== "shelf") throw new UserError("LOC-04", "Esa ubicación no se puede desactivar.");
  if (u.active) {
    const [remains] = await c.db.select().from(stock).where(eq(stock.locationId, u.id)).limit(1);
    if (remains) throw new UserError("LOC-05", "Todavía hay artículos en esta ubicación. Muévelos antes de desactivarla.");
  }
  await c.db.update(locations).set({ active: !u.active }).where(eq(locations.id, u.id));
  return u.active ? `${u.code} desactivada.` : `${u.code} reactivada.`;
});
