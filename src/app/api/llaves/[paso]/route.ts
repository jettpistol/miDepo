import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { getDb } from "@/db";
import { passkeys, usuarios } from "@/db/schema";
import { firmar } from "@/lib/claves";
import { iniciarSesion, sesionActual } from "@/lib/sesion";

/**
 * Llaves de acceso (passkeys): huella, rostro, PIN del dispositivo o llave física.
 * Cuatro pasos: registro-opciones / registro-verificar / ingreso-opciones / ingreso-verificar.
 */

const COOKIE = "midepo_desafio";
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64url");

async function sitio() {
  const h = await headers();
  const url = process.env.APP_URL ? new URL(process.env.APP_URL) : new URL(`${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`);
  return { origen: url.origin, rpID: url.hostname };
}

async function guardarDesafio(desafio: string) {
  (await cookies()).set(COOKIE, `${desafio}.${firmar(desafio)}`, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 300, path: "/api/llaves" });
}

async function tomarDesafio() {
  const jar = await cookies();
  const [desafio, firma] = (jar.get(COOKIE)?.value ?? "").split(".");
  jar.delete(COOKIE);
  return desafio && firma === firmar(desafio) ? desafio : null;
}

const fallo = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ paso: string }> }) {
  const { paso } = await params;
  const { origen, rpID } = await sitio();
  const db = await getDb();

  if (paso === "ingreso-opciones") {
    const opciones = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
    await guardarDesafio(opciones.challenge);
    return NextResponse.json(opciones);
  }

  if (paso === "ingreso-verificar") {
    const desafio = await tomarDesafio();
    const respuesta = await req.json();
    if (!desafio) return fallo("El intento venció. Probá de nuevo.");
    const [fila] = await db.select({ llave: passkeys, usuario: usuarios }).from(passkeys).innerJoin(usuarios, eq(usuarios.id, passkeys.usuarioId)).where(eq(passkeys.id, String(respuesta.id)));
    if (!fila || !fila.usuario.activo) return fallo("Esta llave no está registrada en miDepo. Entrá de otra forma y registrala en Mi cuenta.");
    try {
      const v = await verifyAuthenticationResponse({
        response: respuesta,
        expectedChallenge: desafio,
        expectedOrigin: origen,
        expectedRPID: rpID,
        credential: { id: fila.llave.id, publicKey: Buffer.from(fila.llave.clavePublica, "base64url"), counter: fila.llave.contador },
      });
      if (!v.verified) return fallo("No se pudo verificar la llave.");
      await db.update(passkeys).set({ contador: v.authenticationInfo.newCounter }).where(eq(passkeys.id, fila.llave.id));
    } catch {
      return fallo("No se pudo verificar la llave.");
    }
    await iniciarSesion(fila.usuario.id);
    return NextResponse.json({ ok: true });
  }

  const s = await sesionActual();
  if (!s) return fallo("Primero hay que ingresar.", 401);

  if (paso === "registro-opciones") {
    const existentes = await db.select({ id: passkeys.id }).from(passkeys).where(eq(passkeys.usuarioId, s.usuario.id));
    const opciones = await generateRegistrationOptions({
      rpName: "miDepo",
      rpID,
      userName: s.usuario.email,
      userDisplayName: s.usuario.nombre,
      userID: new TextEncoder().encode(`midepo-${s.usuario.id}`),
      attestationType: "none",
      excludeCredentials: existentes.map((e) => ({ id: e.id })),
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    await guardarDesafio(opciones.challenge);
    return NextResponse.json(opciones);
  }

  if (paso === "registro-verificar") {
    const desafio = await tomarDesafio();
    const { respuesta, nombre } = await req.json();
    if (!desafio) return fallo("El intento venció. Probá de nuevo.");
    try {
      const v = await verifyRegistrationResponse({ response: respuesta, expectedChallenge: desafio, expectedOrigin: origen, expectedRPID: rpID });
      if (!v.verified || !v.registrationInfo) return fallo("No se pudo registrar la llave.");
      const { credential } = v.registrationInfo;
      await db.insert(passkeys).values({ id: credential.id, usuarioId: s.usuario.id, clavePublica: b64(credential.publicKey), contador: credential.counter, transportes: credential.transports?.join(",") ?? null, nombre: String(nombre || "Llave de acceso").slice(0, 40) });
    } catch {
      return fallo("No se pudo registrar la llave.");
    }
    return NextResponse.json({ ok: true });
  }

  return fallo("Paso desconocido.", 404);
}
