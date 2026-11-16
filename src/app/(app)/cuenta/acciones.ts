"use server";

import { and, eq } from "drizzle-orm";
import { accion, txt } from "@/lib/accion";
import { passkeys, usuarioFotos, usuarios } from "@/db/schema";
import { hashPassword, PIN_VALIDO, pinHmac, verificarPassword } from "@/lib/claves";
import { HEX_VALIDO } from "@/lib/color";
import { ErrorUsuario } from "@/lib/errores";

export const guardarApariencia = accion("operario", async (c, f) => {
  const acento = txt(f, "acento");
  const tema = txt(f, "tema");
  if (!HEX_VALIDO.test(acento)) throw new ErrorUsuario("Ese color no es válido.");
  if (tema !== "claro" && tema !== "oscuro" && tema !== "sistema") throw new ErrorUsuario("Elegí un tema.");
  await c.db.update(usuarios).set({ acento: acento.toUpperCase(), tema }).where(eq(usuarios.id, c.usuarioId));
  return "Guardado. Así vas a ver miDepo en todos tus dispositivos.";
});

export const cambiarClave = accion("operario", async (c, f) => {
  const nueva = txt(f, "nueva");
  if (c.usuario.passwordHash && !verificarPassword(txt(f, "actual"), c.usuario.passwordHash)) throw new ErrorUsuario("La contraseña actual no es esa.");
  if (nueva.length < 8) throw new ErrorUsuario("La contraseña nueva necesita al menos 8 caracteres.");
  await c.db.update(usuarios).set({ passwordHash: hashPassword(nueva) }).where(eq(usuarios.id, c.usuarioId));
  return "Contraseña cambiada.";
});

export const cambiarPin = accion("operario", async (c, f) => {
  const pin = txt(f, "pin").trim();
  if (!PIN_VALIDO.test(pin)) throw new ErrorUsuario("El PIN son exactamente 6 números.");
  try {
    await c.db.update(usuarios).set({ pinHmac: pinHmac(c.empresaId, pin) }).where(eq(usuarios.id, c.usuarioId));
  } catch {
    throw new ErrorUsuario("Ese PIN no está disponible. Elegí otro.");
  }
  return "PIN cambiado.";
});

export const quitarLlave = accion("operario", async (c, f) => {
  await c.db.delete(passkeys).where(and(eq(passkeys.id, txt(f, "id")), eq(passkeys.usuarioId, c.usuarioId)));
  return "Llave quitada.";
});

const PREFIJO = "data:image/jpeg;base64,";

export const guardarFoto = accion("operario", async (c, f) => {
  const dato = txt(f, "foto");
  if (!dato.startsWith(PREFIJO)) throw new ErrorUsuario("No pude leer esa imagen. Probá con otra foto.");
  const datos = dato.slice(PREFIJO.length);
  const bytes = Buffer.from(datos, "base64");
  // La foto ya llega recortada y achicada desde el navegador; acá se confirma que sea un JPEG chico.
  if (bytes.length < 100 || bytes.length > 200_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new ErrorUsuario("No pude leer esa imagen. Probá con otra foto.");
  await c.db.transaction(async (tx) => {
    await tx.insert(usuarioFotos).values({ usuarioId: c.usuarioId, datos }).onConflictDoUpdate({ target: usuarioFotos.usuarioId, set: { datos } });
    await tx.update(usuarios).set({ fotoVersion: (c.usuario.fotoVersion ?? 0) + 1 }).where(eq(usuarios.id, c.usuarioId));
  });
  return "Foto guardada.";
});

export const quitarFoto = accion("operario", async (c) => {
  await c.db.transaction(async (tx) => {
    await tx.delete(usuarioFotos).where(eq(usuarioFotos.usuarioId, c.usuarioId));
    await tx.update(usuarios).set({ fotoVersion: null }).where(eq(usuarios.id, c.usuarioId));
  });
  return "Foto quitada.";
});
