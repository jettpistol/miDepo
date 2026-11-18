"use server";

import { redirect } from "next/navigation";
import { accion, num, txt } from "@/lib/accion";
import { cancelarPedido } from "@/lib/flujos/pedidos";
import { confirmarPick, marcarFaltante, tomarPedido } from "@/lib/flujos/picking";

export const tomar = accion("operario", async (c, f) => {
  await tomarPedido(c, num(f, "id"));
  redirect(`/picking/${num(f, "id")}`);
}, { modulo: "picking" });
export const confirmar = accion("operario", (c, f) => confirmarPick(c, { tareaId: num(f, "tareaId"), ubicacion: txt(f, "ubicacion"), producto: txt(f, "producto"), cantidad: f.get("cantidad") }), { modulo: "picking", flujo: "picking" });
export const faltante = accion("operario", (c, f) => marcarFaltante(c, num(f, "tareaId")), { modulo: "picking" });
export const cancelar = accion("supervisor", (c, f) => cancelarPedido(c, num(f, "id")), { modulo: "picking" });
