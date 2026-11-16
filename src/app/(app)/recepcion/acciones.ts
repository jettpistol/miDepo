"use server";

import { redirect } from "next/navigation";
import { accion, num, txt } from "@/lib/accion";
import { cerrarRecepcion, crearRecepcionSinAviso, escanearRecepcion, fijarRecibido } from "@/lib/flujos/recepcion";

export const crear = accion("operario", async (c, f) => {
  const id = await crearRecepcionSinAviso(c, txt(f, "proveedor"));
  redirect(`/recepcion/${id}`);
});
export const escanear = accion("operario", (c, f) => escanearRecepcion(c, num(f, "id"), txt(f, "producto"), f.get("cantidad")));
export const corregir = accion("operario", (c, f) => fijarRecibido(c, num(f, "id"), num(f, "productoId"), f.get("recibido")));
export const cerrar = accion("operario", (c, f) => cerrarRecepcion(c, num(f, "id")));
