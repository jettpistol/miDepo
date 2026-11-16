"use server";

import { accion, num, txt } from "@/lib/accion";
import { cerrarCaja, escanearEnCaja, finalizarEmpaque, vaciarCaja } from "@/lib/flujos/empaque";

export const escanear = accion("operario", (c, f) => escanearEnCaja(c, num(f, "id"), txt(f, "producto"), f.get("cantidad")));
export const cerrar = accion("operario", (c, f) => {
  const kg = Number(txt(f, "kg").replace(",", "."));
  return cerrarCaja(c, num(f, "cajaId"), Number.isFinite(kg) && kg > 0 ? kg * 1000 : undefined);
});
export const vaciar = accion("operario", (c, f) => vaciarCaja(c, num(f, "cajaId")));
export const finalizar = accion("operario", (c, f) => finalizarEmpaque(c, num(f, "id")));
