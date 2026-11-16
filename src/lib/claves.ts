import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function secreto() {
  if (process.env.SECRETO) return process.env.SECRETO;
  // Con base de datos real no se permite el secreto de fábrica: cualquiera podría calcular los PIN.
  if (process.env.DATABASE_URL) throw new Error("Falta la variable SECRETO. Generá una con: openssl rand -hex 32");
  return "solo-para-pruebas-locales";
}

export function hashPassword(clave: string) {
  const sal = randomBytes(16).toString("hex");
  return `scrypt$${sal}$${scryptSync(clave, sal, 32).toString("hex")}`;
}

export function verificarPassword(clave: string, guardado: string | null) {
  if (!guardado) return false;
  const [, sal, hash] = guardado.split("$");
  if (!sal || !hash) return false;
  const a = scryptSync(clave, sal, 32);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** El PIN identifica al operario dentro de su empresa, por eso el hash es determinístico. */
export function pinHmac(empresaId: number, pin: string) {
  return createHmac("sha256", secreto()).update(`${empresaId}:${pin}`).digest("hex");
}

export const PIN_VALIDO = /^\d{6}$/;
export const nuevoToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const firmar = (texto: string) => createHmac("sha256", secreto()).update(texto).digest("base64url");
