"use server";

import { accion, txt } from "@/lib/accion";
import { mover } from "@/lib/flujos/mover";

export const moverAccion = accion("operario", (c, f) => mover(c, { origen: txt(f, "origen"), producto: txt(f, "producto"), destino: txt(f, "destino"), cantidad: f.get("cantidad") }));
