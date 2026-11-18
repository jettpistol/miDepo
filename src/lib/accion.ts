import { revalidatePath } from "next/cache";
import type { Rol, usuarios } from "@/db/schema";
import { ErrorUsuario, intentar, type Resultado } from "./errores";
import type { Empresa } from "./fierro";
import { registrarErrorEscaneo, type Ctx } from "./flujos/comun";
import { requerirEnAccion } from "./sesion";

export type CtxAccion = Ctx & { empresa: Empresa; usuario: typeof usuarios.$inferSelect };

/** Lo que se escaneó o tipeó, sin la clave y con cada valor acotado, para el registro de errores. */
function detalleDe(f: FormData) {
  const d: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string" && k !== "clave" && !k.startsWith("$ACTION")) d[k] = v.slice(0, 80);
  return d;
}

/**
 * Arma una acción de servidor: exige sesión y rol, convierte los errores en mensajes y
 * refresca las pantallas. Lo que devuelve `fn` es el mensaje de éxito.
 *
 * Si el formulario manda `clave`, las operaciones que usan `unaVez` se aplican una sola vez.
 * Con `flujo`, los escaneos rechazados quedan registrados (para medir libros equivocados).
 */
export function accion(minimo: Rol, fn: (c: CtxAccion, f: FormData) => Promise<string | void>, opciones: { flujo?: string; modulo?: string | string[] } = {}) {
  return async (_: Resultado, f: FormData): Promise<Resultado> =>
    intentar(async () => {
      const s = await requerirEnAccion(minimo, opciones.modulo);
      const clave = txt(f, "clave").trim().slice(0, 100) || undefined;
      try {
        const mensaje = await fn({ db: s.db, empresaId: s.empresa.id, usuarioId: s.usuario.id, clave, empresa: s.empresa, usuario: s.usuario }, f);
        revalidatePath("/", "layout");
        return mensaje;
      } catch (e) {
        if (opciones.flujo && e instanceof ErrorUsuario) await registrarErrorEscaneo(s.db, { empresaId: s.empresa.id, usuarioId: s.usuario.id, flujo: opciones.flujo, error: e, detalle: detalleDe(f) });
        throw e;
      }
    });
}

export const num = (f: FormData, campo: string) => Number(f.get(campo));
export const txt = (f: FormData, campo: string) => String(f.get(campo) ?? "");
