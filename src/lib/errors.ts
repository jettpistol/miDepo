/**
 * Every message miDepo shows when something fails carries a code (`AREA-NN`), listed in
 * docs/ERRORS.md. tests/errors.test.ts fails if a code is missing there, repeated or unused.
 */

/** An error whose message is meant to be shown to the user as is, with its code. */
export class UserError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "UserError";
  }
}

/** The text the user sees: the message, then the code to quote to a supervisor. */
export const withCode = (message: string, code: string) => `${message} · ${code}`;

export type Result = { ok?: string; error?: string; sound?: "ok" | "error" };

/** Wraps an action: a UserError is shown; anything else is logged and reported generically. */
export async function attempt(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const ok = await fn();
    return { ok: ok ?? "Listo", sound: "ok" };
  } catch (e) {
    if (e instanceof UserError) return { error: withCode(e.message, e.code), sound: "error" };
    // Next's redirect() and notFound() propagate as exceptions: they have to be let through.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[SYS-01]", e);
    return { error: withCode("Error inesperado. Prueba de nuevo; si persiste, avisa a un supervisor.", "SYS-01"), sound: "error" };
  }
}
