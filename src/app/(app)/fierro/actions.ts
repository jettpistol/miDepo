"use server";

import { action, num, txt } from "@/lib/action";
import { UserError } from "@/lib/errors";
import { isExportType, markSent, simulateNews, syncFromFierro } from "@/lib/flows/exports";

export const syncNow = action("supervisor", async (c) => {
  const r = await syncFromFierro(c, c.company);
  const parts = [`${r.titles} artículos`, `${r.customers} clientes`, `${r.newOrders} pedidos nuevos`];
  if (r.changedOrders) parts.push(`${r.changedOrders} pedidos actualizados`);
  if (r.cancelledOrders) parts.push(`${r.cancelledOrders} anulados`);
  if (r.flaggedOrders) parts.push(`${r.flaggedOrders} ya empezados con cambios en Fierro`);
  if (r.skippedOrders) parts.push(`${r.skippedOrders} sin cliente conocido, no importados`);
  parts.push(`${r.newReceipts} recepciones nuevas`);
  return `Sincronizado: ${parts.join(", ")}.`;
});

export const simulate = action("supervisor", async (c, f) => {
  const what = txt(f, "what") === "receipts" ? "receipts" : "orders";
  const howManyOf = Math.min(50, Math.max(1, num(f, "howManyOf") || 1));
  const r = await simulateNews(c.db, c.company, what, howManyOf, c.userId);
  return what === "orders" ? `Entraron ${r.newOrders} pedidos nuevos desde el Fierro simulado.` : `Fierro avisó ${r.newReceipts} recepciones nuevas.`;
});

export const submit = action("supervisor", (c, f) => {
  const type = txt(f, "type");
  if (!isExportType(type)) throw new UserError("EXP-09", "Documento desconocido.");
  return markSent(c, c.company, type, num(f, "id"));
});
