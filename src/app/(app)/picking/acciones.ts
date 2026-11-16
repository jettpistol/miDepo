"use server";

import { redirect } from "next/navigation";
import { accion, num, txt } from "@/lib/accion";
import { confirmarPick, marcarFaltante, tomarPedido } from "@/lib/flujos/picking";

export const tomar = accion("operario", async (c, f) => {
  await tomarPedido(c, num(f, "id"));
  redirect(`/picking/${num(f, "id")}`);
});
export const confirmar = accion("operario", (c, f) => confirmarPick(c, { tareaId: num(f, "tareaId"), ubicacion: txt(f, "ubicacion"), producto: txt(f, "producto"), cantidad: f.get("cantidad") }));
export const faltante = accion("operario", (c, f) => marcarFaltante(c, num(f, "tareaId")));
