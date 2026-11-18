"use server";

import { redirect } from "next/navigation";
import { accion, num, txt } from "@/lib/accion";
import { cerrarDevolucion, crearDevolucion, escanearDevolucion, quitarLineaDevolucion } from "@/lib/flujos/devoluciones";

export const crear = accion("operario", async (c, f) => {
  const id = await crearDevolucion(c, num(f, "clienteId"));
  redirect(`/devoluciones/${id}`);
}, { modulo: "devoluciones" });
export const escanear = accion("operario", (c, f) => escanearDevolucion(c, num(f, "id"), txt(f, "producto"), txt(f, "estadoLibro"), f.get("cantidad")), { modulo: "devoluciones", flujo: "devolucion" });
export const quitar = accion("operario", (c, f) => quitarLineaDevolucion(c, num(f, "id"), num(f, "productoId"), txt(f, "estadoLibro")), { modulo: "devoluciones" });
export const cerrar = accion("operario", (c, f) => cerrarDevolucion(c, num(f, "id")), { modulo: "devoluciones" });
