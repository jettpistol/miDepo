"use server";

import { and, eq } from "drizzle-orm";
import { accion, num, txt } from "@/lib/accion";
import { empresas, stock, ubicaciones } from "@/db/schema";
import { ErrorUsuario } from "@/lib/errores";
import { generarCodigos, validarEsquema, type Esquema } from "@/lib/ubicaciones";

export const generar = accion("supervisor", async (c, f) => {
  let esquema: Esquema;
  try {
    esquema = JSON.parse(txt(f, "esquema"));
  } catch {
    throw new ErrorUsuario("No pude leer el esquema. Recargá la página y probá de nuevo.");
  }
  const problema = validarEsquema(esquema);
  if (problema) throw new ErrorUsuario(problema);
  const codigos = generarCodigos(esquema);
  let nuevas = 0;
  await c.db.transaction(async (tx) => {
    for (let i = 0; i < codigos.length; i += 1000) {
      const creadas = await tx.insert(ubicaciones).values(codigos.slice(i, i + 1000).map((codigo) => ({ empresaId: c.empresaId, codigo }))).onConflictDoNothing().returning({ id: ubicaciones.id });
      nuevas += creadas.length;
    }
    await tx.update(empresas).set({ esquemaUbicaciones: esquema }).where(eq(empresas.id, c.empresaId));
  });
  const repetidas = codigos.length - nuevas;
  return `Se crearon ${nuevas} ubicaciones${repetidas ? ` (${repetidas} ya existían y no se tocaron)` : ""}. Ya podés imprimir las etiquetas.`;
});

export const crearSuelta = accion("supervisor", async (c, f) => {
  const codigo = txt(f, "codigo").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,19}$/.test(codigo)) throw new ErrorUsuario("El código admite letras, números, guiones y puntos (hasta 20 caracteres, sin espacios ni Ñ).");
  const creada = await c.db.insert(ubicaciones).values({ empresaId: c.empresaId, codigo }).onConflictDoNothing().returning();
  if (creada.length === 0) throw new ErrorUsuario(`La ubicación ${codigo} ya existe.`);
  return `Ubicación ${codigo} creada.`;
});

export const alternar = accion("supervisor", async (c, f) => {
  const [u] = await c.db.select().from(ubicaciones).where(and(eq(ubicaciones.id, num(f, "id")), eq(ubicaciones.empresaId, c.empresaId)));
  if (!u || u.tipo !== "estanteria") throw new ErrorUsuario("Esa ubicación no se puede dar de baja.");
  if (u.activa) {
    const [queda] = await c.db.select().from(stock).where(eq(stock.ubicacionId, u.id)).limit(1);
    if (queda) throw new ErrorUsuario("Todavía hay libros en esta ubicación. Movelos antes de darla de baja.");
  }
  await c.db.update(ubicaciones).set({ activa: !u.activa }).where(eq(ubicaciones.id, u.id));
  return u.activa ? `${u.codigo} dada de baja.` : `${u.codigo} activa de nuevo.`;
});
