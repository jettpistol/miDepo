import type { DB } from "@/db";
import { ErrorUsuario } from "../errores";

export type Ctx = { db: DB; empresaId: number; usuarioId: number };

export function cantidadValida(v: unknown, mensaje = "La cantidad tiene que ser un número entero mayor que cero.") {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 100000) throw new ErrorUsuario(mensaje);
  return n;
}
