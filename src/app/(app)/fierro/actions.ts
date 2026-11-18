"use server";

import { action, num, txt } from "@/lib/action";
import { UserError } from "@/lib/errors";
import { sync } from "@/lib/fierro";
import { markSent, simulateNews, type ExportType } from "@/lib/flows/exports";

export const syncNow = action("supervisor", async (c) => {
  const r = await sync(c.db, c.company);
  return `Sincronizado: ${r.titles} títulos, ${r.customers} clientes, ${r.newOrders} pedidos nuevos, ${r.newReceipts} ingresos nuevos.`;
});

export const simulate = action("supervisor", async (c, f) => {
  const what = txt(f, "what") === "receipts" ? "receipts" : "orders";
  const howManyOf = Math.min(50, Math.max(1, num(f, "howManyOf") || 1));
  const r = await simulateNews(c.db, c.company, what, howManyOf);
  return what === "orders" ? `Entraron ${r.newOrders} pedidos nuevos desde el Fierro simulado.` : `Fierro avisó ${r.newReceipts} ingresos nuevos.`;
});

export const submit = action("supervisor", (c, f) => {
  const type = txt(f, "type") as ExportType;
  if (!["order", "receiving", "return", "count"].includes(type)) throw new UserError("EXP-09", "Documento desconocido.");
  return markSent(c, c.company, type, num(f, "id"));
});
