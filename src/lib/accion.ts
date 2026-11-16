import { revalidatePath } from "next/cache";
import type { Rol, usuarios } from "@/db/schema";
import { intentar, type Resultado } from "./errores";
import type { Empresa } from "./fierro";
import type { Ctx } from "./flujos/comun";
import { requerirEnAccion } from "./sesion";

export type CtxAccion = Ctx & { empresa: Empresa; usuario: typeof usuarios.$inferSelect };

/**
 * Arma una acción de servidor: exige sesión y rol, convierte los errores en mensajes y
 * refresca las pantallas. Lo que devuelve `fn` es el mensaje de éxito.
 */
export function accion(minimo: Rol, fn: (c: CtxAccion, f: FormData) => Promise<string | void>) {
  return async (_: Resultado, f: FormData): Promise<Resultado> =>
    intentar(async () => {
      const s = await requerirEnAccion(minimo);
      const mensaje = await fn({ db: s.db, empresaId: s.empresa.id, usuarioId: s.usuario.id, empresa: s.empresa, usuario: s.usuario }, f);
      revalidatePath("/", "layout");
      return mensaje;
    });
}

export const num = (f: FormData, campo: string) => Number(f.get(campo));
export const txt = (f: FormData, campo: string) => String(f.get(campo) ?? "");
