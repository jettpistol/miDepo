"use server";

import { and, eq } from "drizzle-orm";
import { action, txt } from "@/lib/action";
import { passkeys, userPhotos, users } from "@/db/schema";
import { hashPassword, VALID_PIN, pinHmac, verifyPassword } from "@/lib/credentials";
import { VALID_HEX } from "@/lib/color";
import { UserError } from "@/lib/errors";

export const saveAppearance = action("operator", async (c, f) => {
  const accent = txt(f, "accent");
  const theme = txt(f, "theme");
  if (!VALID_HEX.test(accent)) throw new UserError("Ese color no es válido.");
  if (theme !== "light" && theme !== "dark" && theme !== "system") throw new UserError("Elegí un tema.");
  await c.db.update(users).set({ accent: accent.toUpperCase(), theme }).where(eq(users.id, c.userId));
  return "Guardado. Así vas a ver miDepo en todos tus dispositivos.";
});

export const changePassword = action("operator", async (c, f) => {
  const newPassword = txt(f, "newPassword");
  if (c.user.passwordHash && !verifyPassword(txt(f, "current"), c.user.passwordHash)) throw new UserError("La contraseña actual no es esa.");
  if (newPassword.length < 8) throw new UserError("La contraseña nueva necesita al menos 8 caracteres.");
  await c.db.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, c.userId));
  return "Contraseña cambiada.";
});

export const changePin = action("operator", async (c, f) => {
  const pin = txt(f, "pin").trim();
  if (!VALID_PIN.test(pin)) throw new UserError("El PIN son exactamente 6 números.");
  try {
    await c.db.update(users).set({ pinHmac: pinHmac(c.companyId, pin) }).where(eq(users.id, c.userId));
  } catch {
    throw new UserError("Ese PIN no está disponible. Elegí otro.");
  }
  return "PIN cambiado.";
});

export const removePasskey = action("operator", async (c, f) => {
  await c.db.delete(passkeys).where(and(eq(passkeys.id, txt(f, "id")), eq(passkeys.userId, c.userId)));
  return "Llave quitada.";
});

const PREFIX = "data:image/jpeg;base64,";

export const savePhoto = action("operator", async (c, f) => {
  const payload = txt(f, "photo");
  if (!payload.startsWith(PREFIX)) throw new UserError("No pude leer esa imagen. Probá con otra foto.");
  const data = payload.slice(PREFIX.length);
  const bytes = Buffer.from(data, "base64");
  // The photo arrives already cropped and shrunk by the browser; here we only confirm it is a small JPEG.
  if (bytes.length < 100 || bytes.length > 200_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new UserError("No pude leer esa imagen. Probá con otra foto.");
  await c.db.transaction(async (tx) => {
    await tx.insert(userPhotos).values({ userId: c.userId, data }).onConflictDoUpdate({ target: userPhotos.userId, set: { data } });
    await tx.update(users).set({ photoVersion: (c.user.photoVersion ?? 0) + 1 }).where(eq(users.id, c.userId));
  });
  return "Foto guardada.";
});

export const removePhoto = action("operator", async (c) => {
  await c.db.transaction(async (tx) => {
    await tx.delete(userPhotos).where(eq(userPhotos.userId, c.userId));
    await tx.update(users).set({ photoVersion: null }).where(eq(users.id, c.userId));
  });
  return "Foto quitada.";
});
