"use server";

import { and, eq } from "drizzle-orm";
import { action, txt } from "@/lib/action";
import { companies, passkeys, userPhotos, users } from "@/db/schema";
import { hashPassword, VALID_PIN, pinHmac, verifyPassword } from "@/lib/credentials";
import { VALID_HEX } from "@/lib/color";
import { isFont } from "@/lib/fonts";
import { UserError } from "@/lib/errors";

export const saveAppearance = action("operator", async (c, f) => {
  const accent = txt(f, "accent");
  const theme = txt(f, "theme");
  const font = txt(f, "font");
  if (!VALID_HEX.test(accent)) throw new UserError("ACCT-01", "Ese color no es válido.");
  if (!isFont(font)) throw new UserError("ACCT-02", "Elige una tipografía de la lista.");
  await c.db.update(users).set({ accent: accent.toUpperCase(), theme: validTheme(theme), font }).where(eq(users.id, c.userId));
  return "Apariencia guardada. Se aplica en todos tus dispositivos.";
});

function validTheme(theme: string) {
  if (theme !== "light" && theme !== "dark" && theme !== "system") throw new UserError("ACCT-03", "Elige un tema.");
  return theme;
}

/** The light/dark switch in the top bar: saved at once, without opening Ajustes. */
export const saveTheme = action("operator", async (c, f) => {
  await c.db.update(users).set({ theme: validTheme(txt(f, "theme")) }).where(eq(users.id, c.userId));
});

export const changePassword = action("operator", async (c, f) => {
  const newPassword = txt(f, "newPassword");
  if (c.user.passwordHash && !verifyPassword(txt(f, "current"), c.user.passwordHash)) throw new UserError("ACCT-04", "La contraseña actual no es correcta.");
  if (newPassword.length < 8) throw new UserError("ACCT-05", "La contraseña nueva necesita al menos 8 caracteres.");
  await c.db.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, c.userId));
  return "Contraseña cambiada.";
});

export const changePin = action("operator", async (c, f) => {
  const pin = txt(f, "pin").trim();
  if (!VALID_PIN.test(pin)) throw new UserError("ACCT-06", "El PIN debe tener exactamente 6 dígitos.");
  try {
    await c.db.update(users).set({ pinHmac: pinHmac(c.companyId, pin) }).where(eq(users.id, c.userId));
  } catch {
    throw new UserError("ACCT-07", "Ese PIN no está disponible. Elige otro.");
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
  if (!payload.startsWith(PREFIX)) throw new UserError("ACCT-08", "No se pudo leer esa imagen. Prueba con otra foto.");
  const data = payload.slice(PREFIX.length);
  const bytes = Buffer.from(data, "base64");
  // The photo arrives already cropped and shrunk by the browser; here we only confirm it is a small JPEG.
  if (bytes.length < 100 || bytes.length > 200_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new UserError("ACCT-09", "No se pudo leer esa imagen. Prueba con otra foto.");
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

/** For the whole company: how picking batches are split into orders. Open batches keep theirs. */
export const saveBatchSorting = action("supervisor", async (c, f) => {
  const sorting = txt(f, "sorting");
  if (sorting !== "packing" && sorting !== "trays") throw new UserError("ACCT-11", "Elige cómo se separa el lote.");
  await c.db.update(companies).set({ batchSorting: sorting }).where(eq(companies.id, c.companyId));
  return sorting === "trays" ? "Guardado. Los lotes nuevos se separan por bandeja." : "Guardado. Los lotes nuevos se separan en empaque.";
});
