"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { empresas, intentosLogin, usuarios } from "@/db/schema";
import { PIN_VALIDO, pinHmac, verificarPassword } from "@/lib/claves";
import { ErrorUsuario, intentar, type Resultado } from "@/lib/errores";
import { cerrarSesion, iniciarSesion } from "@/lib/sesion";

const MAXIMO = 6;
const BLOQUEO_MIN = 5;

/** Frena los intentos repetidos: tras varios fallos seguidos, hay que esperar unos minutos. */
async function conLimite<T>(clave: string, probar: () => Promise<T | null>): Promise<T> {
  const db = await getDb();
  const [i] = await db.select().from(intentosLogin).where(eq(intentosLogin.clave, clave));
  if (i?.bloqueadoHasta && i.bloqueadoHasta > new Date()) throw new ErrorUsuario(`Demasiados intentos. Esperá ${BLOQUEO_MIN} minutos y probá de nuevo.`);
  const resultado = await probar();
  if (resultado) {
    await db.delete(intentosLogin).where(eq(intentosLogin.clave, clave));
    return resultado;
  }
  const cantidad = (i?.bloqueadoHasta ? 0 : (i?.cantidad ?? 0)) + 1;
  const bloqueadoHasta = cantidad >= MAXIMO ? new Date(Date.now() + BLOQUEO_MIN * 60_000) : null;
  await db.insert(intentosLogin).values({ clave, cantidad, bloqueadoHasta }).onConflictDoUpdate({ target: intentosLogin.clave, set: { cantidad, bloqueadoHasta } });
  throw new ErrorUsuario("Los datos no coinciden. Revisalos y probá de nuevo.");
}

const origen = async () => (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";

export async function ingresarConClave(_: Resultado, f: FormData): Promise<Resultado> {
  return intentar(async () => {
    const email = String(f.get("email") ?? "").toLowerCase().trim();
    const clave = String(f.get("clave") ?? "");
    if (!email || !clave) throw new ErrorUsuario("Completá el email y la contraseña.");
    const usuario = await conLimite(`clave:${email}`, async () => {
      const [u] = await (await getDb()).select().from(usuarios).where(and(eq(usuarios.email, email), eq(usuarios.activo, true)));
      return u && verificarPassword(clave, u.passwordHash) ? u : null;
    });
    await iniciarSesion(usuario.id);
    redirect("/");
  });
}

export async function ingresarConPin(_: Resultado, f: FormData): Promise<Resultado> {
  return intentar(async () => {
    const slug = String(f.get("empresa") ?? "").toLowerCase().trim();
    const pin = String(f.get("pin") ?? "").trim();
    if (!slug) throw new ErrorUsuario("Escribí el código de tu empresa. Te lo da tu supervisor.");
    if (!PIN_VALIDO.test(pin)) throw new ErrorUsuario("El PIN tiene 6 números.");
    const usuario = await conLimite(`pin:${slug}:${await origen()}`, async () => {
      const db = await getDb();
      const [e] = await db.select().from(empresas).where(eq(empresas.slug, slug));
      if (!e) return null;
      const [u] = await db.select().from(usuarios).where(and(eq(usuarios.empresaId, e.id), eq(usuarios.pinHmac, pinHmac(e.id, pin)), eq(usuarios.activo, true)));
      return u ?? null;
    });
    // Con PIN la sesión dura un turno largo: al día siguiente hay que volver a entrar.
    await iniciarSesion(usuario.id, 14);
    redirect("/");
  });
}

export async function salir() {
  await cerrarSesion();
  redirect("/ingresar");
}
