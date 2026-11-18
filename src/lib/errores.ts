import type { TipoError } from "@/db/schema";

/**
 * Error con un mensaje pensado para mostrarle al usuario tal cual. El `tipo` distingue los
 * escaneos equivocados (libro o estante que no era) del resto, para poder medirlos.
 */
export class ErrorUsuario extends Error {
  constructor(
    mensaje: string,
    readonly tipo: TipoError = "otro",
  ) {
    super(mensaje);
  }
}

export type Resultado = { ok?: string; error?: string; sonido?: "ok" | "error" };

/** Envuelve una acción: los ErrorUsuario se muestran, el resto se registra y se informa genérico. */
export async function intentar(fn: () => Promise<string | void>): Promise<Resultado> {
  try {
    const ok = await fn();
    return { ok: ok ?? "Listo", sonido: "ok" };
  } catch (e) {
    if (e instanceof ErrorUsuario) return { error: e.message, sonido: "error" };
    // Los redirect() y notFound() de Next se propagan como excepciones: hay que dejarlos pasar.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { error: "Algo salió mal. Probá de nuevo; si sigue, avisá a tu supervisor.", sonido: "error" };
  }
}
