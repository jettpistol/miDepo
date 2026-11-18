"use server";

import { accion, num, txt } from "@/lib/accion";
import { ErrorUsuario } from "@/lib/errores";
import { sincronizar } from "@/lib/fierro";
import { marcarEnviado, simularNovedades, type TipoEnvio } from "@/lib/flujos/envios";

export const sincronizarAhora = accion("supervisor", async (c) => {
  const r = await sincronizar(c.db, c.empresa);
  return `Sincronizado: ${r.titulos} títulos, ${r.clientes} clientes, ${r.pedidosNuevos} pedidos nuevos, ${r.ingresosNuevos} ingresos nuevos.`;
}, { modulo: "fierro" });

export const simular = accion("supervisor", async (c, f) => {
  const que = txt(f, "que") === "ingresos" ? "ingresos" : "pedidos";
  const cuantos = Math.min(50, Math.max(1, num(f, "cuantos") || 1));
  const r = await simularNovedades(c.db, c.empresa, que, cuantos);
  return que === "pedidos" ? `Entraron ${r.pedidosNuevos} pedidos nuevos desde el Fierro simulado.` : `Fierro avisó ${r.ingresosNuevos} ingresos nuevos.`;
}, { modulo: "fierro" });

export const enviar = accion("supervisor", (c, f) => {
  const tipo = txt(f, "tipo") as TipoEnvio;
  if (!["pedido", "recepcion", "devolucion", "conteo"].includes(tipo)) throw new ErrorUsuario("Documento desconocido.");
  return marcarEnviado(c, c.empresa, tipo, num(f, "id"));
}, { modulo: "fierro" });
