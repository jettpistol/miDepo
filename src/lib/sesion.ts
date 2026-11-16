import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { empresas, sesiones, usuarios, type Rol } from "@/db/schema";
import { hashToken, nuevoToken } from "./claves";
import { ErrorUsuario } from "./errores";

const COOKIE = "midepo_sesion";
const DIAS = 30;

export async function iniciarSesion(usuarioId: number, horas = DIAS * 24) {
  const db = await getDb();
  const token = nuevoToken();
  const expira = new Date(Date.now() + horas * 3600_000);
  await db.insert(sesiones).values({ tokenHash: hashToken(token), usuarioId, expira });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expira });
}

export async function cerrarSesion() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await (await getDb()).delete(sesiones).where(eq(sesiones.tokenHash, hashToken(token)));
  jar.delete(COOKIE);
}

/** Usuario y empresa de quien hace el pedido, o null. Se calcula una sola vez por pedido. */
export const sesionActual = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [fila] = await db
    .select({ usuario: usuarios, empresa: empresas })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .innerJoin(empresas, eq(empresas.id, usuarios.empresaId))
    .where(and(eq(sesiones.tokenHash, hashToken(token)), gt(sesiones.expira, new Date()), eq(usuarios.activo, true)))
    .limit(1);
  return fila ?? null;
});

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
