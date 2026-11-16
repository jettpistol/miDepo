"use server";

import { redirect } from "next/navigation";
import { accion, num, txt } from "@/lib/accion";
import { cerrarConteo, crearConteo, escanearConteo, fijarContado, marcarUbicacion } from "@/lib/flujos/conteos";

export const crear = accion("supervisor", async (c, f) => {
  const id = await crearConteo(c, txt(f, "nombre"), txt(f, "prefijo"));
  redirect(`/conteos/${id}`);
});
export const escanear = accion("operario", (c, f) => escanearConteo(c, num(f, "id"), num(f, "ubicacionId"), txt(f, "producto"), f.get("cantidad")));
export const corregir = accion("operario", (c, f) => fijarContado(c, num(f, "id"), num(f, "ubicacionId"), num(f, "productoId"), f.get("contado")));
export const terminar = accion("operario", async (c, f) => {
  await marcarUbicacion(c, num(f, "id"), num(f, "ubicacionId"), true);
  redirect(`/conteos/${num(f, "id")}`);
});
export const reabrir = accion("supervisor", (c, f) => marcarUbicacion(c, num(f, "id"), num(f, "ubicacionId"), false));
export const aprobar = accion("supervisor", (c, f) => cerrarConteo(c, num(f, "id")));
