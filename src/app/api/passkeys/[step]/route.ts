import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { getDb } from "@/db";
import { passkeys, users } from "@/db/schema";
import { sign } from "@/lib/credentials";
import { withCode } from "@/lib/errors";
import { startSession, currentSession } from "@/lib/session";

/**
 * Passkeys: fingerprint, face, device PIN or a hardware key.
 * Four steps: register-options / register-verify / login-options / login-verify.
 */

const COOKIE = "midepo_challenge";
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64url");

async function site() {
  const h = await headers();
  const url = process.env.APP_URL ? new URL(process.env.APP_URL) : new URL(`${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`);
  return { source: url.origin, rpID: url.hostname };
}

async function saveChallenge(challenge: string) {
  (await cookies()).set(COOKIE, `${challenge}.${sign(challenge)}`, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 300, path: "/api/passkeys" });
}

async function takeChallenge() {
  const jar = await cookies();
  const [challenge, signature] = (jar.get(COOKIE)?.value ?? "").split(".");
  jar.delete(COOKIE);
  return challenge && signature === sign(challenge) ? challenge : null;
}

const failed = (code: string, error: string, status = 400) => NextResponse.json({ error: withCode(error, code) }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const { source, rpID } = await site();
  const db = await getDb();

  if (step === "login-options") {
    const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
    await saveChallenge(options.challenge);
    return NextResponse.json(options);
  }

  if (step === "login-verify") {
    const challenge = await takeChallenge();
    const reply = await req.json();
    if (!challenge) return failed("PKEY-01", "El intento venció. Prueba de nuevo.");
    const [row] = await db.select({ passkey: passkeys, user: users }).from(passkeys).innerJoin(users, eq(users.id, passkeys.userId)).where(eq(passkeys.id, String(reply.id)));
    if (!row || !row.user.active) return failed("PKEY-02", "Esta llave no está registrada en miDepo. Entra de otra forma y regístrala en Ajustes.");
    try {
      const v = await verifyAuthenticationResponse({
        response: reply,
        expectedChallenge: challenge,
        expectedOrigin: source,
        expectedRPID: rpID,
        credential: { id: row.passkey.id, publicKey: Buffer.from(row.passkey.publicKeyData, "base64url"), counter: row.passkey.sequence },
      });
      if (!v.verified) return failed("PKEY-03", "No se pudo verificar la llave.");
      await db.update(passkeys).set({ sequence: v.authenticationInfo.newCounter }).where(eq(passkeys.id, row.passkey.id));
    } catch {
      return failed("PKEY-04", "No se pudo verificar la llave.");
    }
    await startSession(row.user.id);
    return NextResponse.json({ ok: true });
  }

  const s = await currentSession();
  if (!s) return failed("PKEY-05", "Primero hay que ingresar.", 401);

  if (step === "register-options") {
    const existing = await db.select({ id: passkeys.id }).from(passkeys).where(eq(passkeys.userId, s.user.id));
    const options = await generateRegistrationOptions({
      rpName: "miDepo",
      rpID,
      userName: s.user.email,
      userDisplayName: s.user.name,
      userID: new TextEncoder().encode(`midepo-${s.user.id}`),
      attestationType: "none",
      excludeCredentials: existing.map((e) => ({ id: e.id })),
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    await saveChallenge(options.challenge);
    return NextResponse.json(options);
  }

  if (step === "register-verify") {
    const challenge = await takeChallenge();
    const { reply, name } = await req.json();
    if (!challenge) return failed("PKEY-06", "El intento venció. Prueba de nuevo.");
    try {
      const v = await verifyRegistrationResponse({ response: reply, expectedChallenge: challenge, expectedOrigin: source, expectedRPID: rpID });
      if (!v.verified || !v.registrationInfo) return failed("PKEY-07", "No se pudo registrar la llave.");
      const { credential } = v.registrationInfo;
      await db.insert(passkeys).values({ id: credential.id, userId: s.user.id, publicKeyData: b64(credential.publicKey), sequence: credential.counter, carriers: credential.transports?.join(",") ?? null, name: String(name || "Llave de acceso").slice(0, 40) });
    } catch {
      return failed("PKEY-08", "No se pudo registrar la llave.");
    }
    return NextResponse.json({ ok: true });
  }

  return failed("PKEY-09", "Paso desconocido.", 404);
}
