import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { empresas, sesiones, usuarios, type Rol } from "@/db/schema";
import { hashToken, nuevoToken } from "./claves";
import { ErrorUsuario } from "./errores";

/**
 * Un dispositivo puede tener varias cuentas abiertas a la vez. `ACTIVA` guarda la sesión en uso
 * y `TODAS` la lista completa; cambiar de cuenta es solo elegir otra de la lista.
 */
const ACTIVA = "midepo_sesion";
const TODAS = "midepo_sesiones";
const DIAS = 30;
export const MAXIMO_CUENTAS = 5;

type Jar = Awaited<ReturnType<typeof cookies>>;
const opciones = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: DIAS * 86400 });

function guardar(jar: Jar, tokens: string[], activa: string | undefined) {
  if (tokens.length === 0 || !activa) {
    jar.delete(ACTIVA);
    jar.delete(TODAS);
    return;
  }
  jar.set(ACTIVA, activa, opciones());
  jar.set(TODAS, tokens.join("."), opciones());
}

/** Sesiones vigentes de este dispositivo, con su token. Solo para uso interno de este módulo. */
const abiertas = cache(async () => {
  const jar = await cookies();
  const activa = jar.get(ACTIVA)?.value;
  const tokens = [...new Set([activa, ...(jar.get(TODAS)?.value.split(".") ?? [])].filter((t): t is string => Boolean(t)))].slice(0, MAXIMO_CUENTAS + 1);
  if (tokens.length === 0) return [];
  const db = await getDb();
  const filas = await db
    .select({ tokenHash: sesiones.tokenHash, usuario: usuarios, empresa: empresas })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .innerJoin(empresas, eq(empresas.id, usuarios.empresaId))
    .where(and(inArray(sesiones.tokenHash, tokens.map(hashToken)), gt(sesiones.expira, new Date()), eq(usuarios.activo, true)));
  const porHash = new Map(filas.map((f) => [f.tokenHash, f]));
  return tokens.flatMap((token) => {
    const f = porHash.get(hashToken(token));
    return f ? [{ token, usuario: f.usuario, empresa: f.empresa, activa: token === activa }] : [];
  });
});

/** Cuentas abiertas en este dispositivo, sin datos secretos: para mostrar el selector. */
export async function cuentasAbiertas() {
  return (await abiertas()).map(({ usuario, empresa, activa }) => ({ usuario, empresa, activa }));
}

/** Usuario y empresa de la cuenta en uso, o null. Se calcula una sola vez por pedido. */
export const sesionActual = cache(async () => {
  const s = (await abiertas()).find((a) => a.activa);
  return s ? { usuario: s.usuario, empresa: s.empresa } : null;
});

/** Abre una sesión y la deja en uso. Las otras cuentas del dispositivo siguen abiertas. */
export async function iniciarSesion(usuarioId: number, horas = DIAS * 24) {
  const db = await getDb();
  const previas = await abiertas();
  const token = nuevoToken();
  await db.insert(sesiones).values({ tokenHash: hashToken(token), usuarioId, expira: new Date(Date.now() + horas * 3600_000) });
  // Si esa persona ya tenía una sesión acá, la nueva la reemplaza; y nunca más de MAXIMO_CUENTAS.
  const siguen = previas.filter((p) => p.usuario.id !== usuarioId).slice(0, MAXIMO_CUENTAS - 1);
  const sobran = previas.filter((p) => !siguen.includes(p));
  if (sobran.length > 0) await db.delete(sesiones).where(inArray(sesiones.tokenHash, sobran.map((s) => hashToken(s.token))));
  guardar(await cookies(), [token, ...siguen.map((s) => s.token)], token);
}

/** Pasa a otra cuenta que ya está abierta en este dispositivo. */
export async function cambiarDeCuenta(usuarioId: number) {
  const todas = await abiertas();
  const destino = todas.find((s) => s.usuario.id === usuarioId);
  if (!destino) return false;
  guardar(await cookies(), todas.map((s) => s.token), destino.token);
  return true;
}

/** Cierra la cuenta en uso (o todas). Si queda otra abierta, pasa a esa. Devuelve si quedó alguna. */
export async function cerrarSesion(todasLasCuentas = false) {
  const todas = await abiertas();
  const cierran = todasLasCuentas ? todas : todas.filter((s) => s.activa);
  const siguen = todas.filter((s) => !cierran.includes(s));
  if (cierran.length > 0) await (await getDb()).delete(sesiones).where(inArray(sesiones.tokenHash, cierran.map((s) => hashToken(s.token))));
  guardar(await cookies(), siguen.map((s) => s.token), siguen[0]?.token);
  return siguen.length > 0;
}

const NIVEL: Record<Rol, number> = { operario: 1, supervisor: 2, admin: 3 };
export const puede = (rol: Rol, minimo: Rol) => NIVEL[rol] >= NIVEL[minimo];

/** Para páginas: sin sesión manda al ingreso; sin permiso, al inicio. */
export async function requerir(minimo: Rol = "operario") {
  const s = await sesionActual();
  if (!s) redirect("/ingresar");
  if (!puede(s.usuario.rol, minimo)) redirect("/");
  return { ...s, db: await getDb() };
}

/** Para acciones: igual que requerir, pero la falta de permiso es un mensaje y no un salto. */
export async function requerirEnAccion(minimo: Rol = "operario") {
  const s = await sesionActual();
  if (!s) redirect("/ingresar");
  if (!puede(s.usuario.rol, minimo)) throw new ErrorUsuario("Tu usuario no tiene permiso para hacer esto.");
  return { ...s, db: await getDb() };
}
