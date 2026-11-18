"use server";

import { and, eq } from "drizzle-orm";
import { action, num, txt, type ActionCtx } from "@/lib/action";
import { sessions, userPhotos, users, type Role } from "@/db/schema";
import { createUser } from "@/db/seed";
import { hashPassword, VALID_PIN, pinHmac } from "@/lib/credentials";
import { UserError } from "@/lib/errors";

const ROLES: Role[] = ["operator", "supervisor", "admin"];

function validatePassword(password: string) {
  if (password.length < 8) throw new UserError("USER-01", "La contraseña necesita al menos 8 caracteres.");
}
function validatePin(pin: string) {
  if (!VALID_PIN.test(pin)) throw new UserError("USER-02", "El PIN son exactamente 6 números.");
}
const unique = (e: unknown, code: string, message: string) => {
  // Postgres code 23505: duplicate value in a unique column.
  const failure = (e as { cause?: { code?: string }; code?: string }) ?? {};
  if (failure.code === "23505" || failure.cause?.code === "23505") throw new UserError(code, message);
  throw e;
};

async function ofCompany(c: ActionCtx, id: number) {
  const [u] = await c.db.select().from(users).where(and(eq(users.id, id), eq(users.companyId, c.companyId)));
  if (!u) throw new UserError("USER-03", "No encuentro a esa persona.");
  return u;
}

export const create = action("admin", async (c, f) => {
  const name = txt(f, "name").trim();
  const email = txt(f, "email").toLowerCase().trim();
  const role = txt(f, "role") as Role;
  const password = txt(f, "password");
  const pin = txt(f, "pin").trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new UserError("USER-04", "Completá el nombre y un email válido.");
  if (!ROLES.includes(role)) throw new UserError("USER-05", "Elegí un rol.");
  if (!password && !pin) throw new UserError("USER-06", "Dale una contraseña, un PIN o las dos cosas para que pueda entrar.");
  if (password) validatePassword(password);
  if (pin) validatePin(pin);
  await createUser(c.db, c.companyId, { name, email, role, password: password || undefined, pin: pin || undefined }).catch((e) => unique(e, "USER-11", "Ese email o ese PIN ya lo usa otra persona."));
  return `${name} ya puede entrar a miDepo.`;
});

export const changeRole = action("admin", async (c, f) => {
  const u = await ofCompany(c, num(f, "id"));
  const role = txt(f, "role") as Role;
  if (!ROLES.includes(role)) throw new UserError("USER-07", "Elegí un rol.");
  if (u.id === c.userId) throw new UserError("USER-08", "No podés cambiar tu propio rol. Pedíselo a otro administrador.");
  await c.db.update(users).set({ role }).where(eq(users.id, u.id));
  return `${u.name} ahora es ${role}.`;
});

export const toggleActive = action("admin", async (c, f) => {
  const u = await ofCompany(c, num(f, "id"));
  if (u.id === c.userId) throw new UserError("USER-09", "No podés darte de baja a vos mismo.");
  await c.db.update(users).set({ active: !u.active }).where(eq(users.id, u.id));
  if (u.active) await c.db.delete(sessions).where(eq(sessions.userId, u.id));
  return u.active ? `${u.name} ya no puede entrar.` : `${u.name} puede entrar de nuevo.`;
});

export const setAccess = action("admin", async (c, f) => {
  const u = await ofCompany(c, num(f, "id"));
  const password = txt(f, "password");
  const pin = txt(f, "pin").trim();
  if (!password && !pin) throw new UserError("USER-10", "Escribí una contraseña nueva, un PIN nuevo o las dos cosas.");
  if (password) validatePassword(password);
  if (pin) validatePin(pin);
  await c.db
    .update(users)
    .set({ ...(password ? { passwordHash: hashPassword(password) } : {}), ...(pin ? { pinHmac: pinHmac(c.companyId, pin) } : {}) })
    .where(eq(users.id, u.id))
    .catch((e) => unique(e, "USER-12", "Ese PIN ya lo usa otra persona. Elegí otro."));
  return `Acceso de ${u.name} actualizado.`;
});

/** For when someone uploads a photo that is not appropriate. */
export const removePhotoOf = action("admin", async (c, f) => {
  const u = await ofCompany(c, num(f, "id"));
  await c.db.transaction(async (tx) => {
    await tx.delete(userPhotos).where(eq(userPhotos.userId, u.id));
    await tx.update(users).set({ photoVersion: null }).where(eq(users.id, u.id));
  });
  return `Foto de ${u.name} quitada.`;
});
