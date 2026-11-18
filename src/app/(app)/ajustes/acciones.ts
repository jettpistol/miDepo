"use server";

import { eq } from "drizzle-orm";
import { accion, txt } from "@/lib/accion";
import { empresas, type ModoEmpresa } from "@/db/schema";
import { ErrorUsuario } from "@/lib/errores";
import { MODULOS } from "@/lib/modulos";

export const guardarAjustes = accion("admin", async (c, f) => {
  const modo = txt(f, "modo") as ModoEmpresa;
  if (modo !== "fierro" && modo !== "independiente") throw new ErrorUsuario("Elegí un modo de trabajo.");
  const modulos = Object.fromEntries(MODULOS.map((m) => [m.id, f.get(`m_${m.id}`) === "on"]));
  if (!modulos.picking && !modulos.recepcion && !modulos.conteos && !modulos.mover && !modulos.guardar) {
    throw new ErrorUsuario("Dejá encendido al menos un módulo de trabajo del depósito.");
  }
  await c.db.update(empresas).set({ modo, modulos }).where(eq(empresas.id, c.empresaId));
  return "Ajustes guardados.";
});
