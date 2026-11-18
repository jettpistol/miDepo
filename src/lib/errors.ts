/** An error whose message is meant to be shown to the user as is. */
export class UserError extends Error {}

export type Result = { ok?: string; error?: string; sound?: "ok" | "error" };

/** Wraps an action: a UserError is shown; anything else is logged and reported generically. */
export async function attempt(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const ok = await fn();
    return { ok: ok ?? "Listo", sound: "ok" };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message, sound: "error" };
    // Next's redirect() and notFound() propagate as exceptions: they have to be let through.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { error: "Algo salió mal. Probá de nuevo; si sigue, avisá a tu supervisor.", sound: "error" };
  }
}
