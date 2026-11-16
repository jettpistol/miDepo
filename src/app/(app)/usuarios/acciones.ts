"use server";

import { and, eq } from "drizzle-orm";
import { accion, num, txt, type CtxAccion } from "@/lib/accion";
import { sesiones, usuarios, type Rol } from "@/db/schema";
import { crearUsuario } from "@/db/seed";
import { hashPassword, PIN_VALIDO, pinHmac } from "@/lib/claves";
import { ErrorUsuario } from "@/lib/errores";

const ROLES: Rol[] = ["operario", "supervisor", "admin"];

function validarClave(clave: string) {
  if (clave.length < 8) throw new ErrorUsuario("La contraseña necesita al menos 8 caracteres.");
}
function validarPin(pin: string) {
  if (!PIN_VALIDO.test(pin)) throw new ErrorUsuario("El PIN son exactamente 6 números.");
}
const unico = (e: unknown, mensaje: string) => {
  // Código 23505 de Postgres: valor repetido en una columna única.
  const causa = (e as { cause?: { code?: string }; code?: string }) ?? {};
  if (causa.code === "23505" || causa.cause?.code === "23505") throw new ErrorUsuario(mensaje);
  throw e;
};

async function deLaEmpresa(c: CtxAccion, id: number) {
  const [u] = await c.db.select().from(usuarios).where(and(eq(usuarios.id, id), eq(usuarios.empresaId, c.empresaId)));
  if (!u) throw new ErrorUsuario("No encuentro a esa persona.");
  return u;
}

export const crear = accion("admin", async (c, f) => {
  const nombre = txt(f, "nombre").trim();
  const email = txt(f, "email").toLowerCase().trim();
  const rol = txt(f, "rol") as Rol;
  const clave = txt(f, "clave");
  const pin = txt(f, "pin").trim();
  if (!nombre || !/^\S+@\S+\.\S+$/.test(email)) throw new ErrorUsuario("Completá el nombre y un email válido.");
  if (!ROLES.includes(rol)) throw new ErrorUsuario("Elegí un rol.");
  if (!clave && !pin) throw new ErrorUsuario("Dale una contraseña, un PIN o las dos cosas para que pueda entrar.");
  if (clave) validarClave(clave);
  if (pin) validarPin(pin);
  await crearUsuario(c.db, c.empresaId, { nombre, email, rol, clave: clave || undefined, pin: pin || undefined }).catch((e) => unico(e, "Ese email o ese PIN ya lo usa otra persona."));
  return `${nombre} ya puede entrar a miDepo.`;
});

export const cambiarRol = accion("admin", async (c, f) => {
  const u = await deLaEmpresa(c, num(f, "id"));
  const rol = txt(f, "rol") as Rol;
  if (!ROLES.includes(rol)) throw new ErrorUsuario("Elegí un rol.");
  if (u.id === c.usuarioId) throw new ErrorUsuario("No podés cambiar tu propio rol. Pedíselo a otro administrador.");
  await c.db.update(usuarios).set({ rol }).where(eq(usuarios.id, u.id));
  return `${u.nombre} ahora es ${rol}.`;
});

export const alternarActivo = accion("admin", async (c, f) => {
  const u = await deLaEmpresa(c, num(f, "id"));
  if (u.id === c.usuarioId) throw new ErrorUsuario("No podés darte de baja a vos mismo.");
  await c.db.update(usuarios).set({ activo: !u.activo }).where(eq(usuarios.id, u.id));
  if (u.activo) await c.db.delete(sesiones).where(eq(sesiones.usuarioId, u.id));
  return u.activo ? `${u.nombre} ya no puede entrar.` : `${u.nombre} puede entrar de nuevo.`;
});

export const fijarAcceso = accion("admin", async (c, f) => {
  const u = await deLaEmpresa(c, num(f, "id"));
  const clave = txt(f, "clave");
  const pin = txt(f, "pin").trim();
  if (!clave && !pin) throw new ErrorUsuario("Escribí una contraseña nueva, un PIN nuevo o las dos cosas.");
  if (clave) validarClave(clave);
  if (pin) validarPin(pin);
  await c.db
    .update(usuarios)
    .set({ ...(clave ? { passwordHash: hashPassword(clave) } : {}), ...(pin ? { pinHmac: pinHmac(c.empresaId, pin) } : {}) })
    .where(eq(usuarios.id, u.id))
    .catch((e) => unico(e, "Ese PIN ya lo usa otra persona. Elegí otro."));
  return `Acceso de ${u.nombre} actualizado.`;
});
