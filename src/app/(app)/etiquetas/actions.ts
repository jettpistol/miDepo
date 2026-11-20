"use server";

import { action, num, type ActionCtx } from "@/lib/action";
import { UserError } from "@/lib/errors";
import { discardLabels, jobById, restoreLabels } from "@/lib/flows/labels";
import { sendLabels, targetFor } from "@/lib/flows/printers";
import { ensureWorkstation } from "@/lib/workstation";

export const discard = action("operator", (c, f) => discardLabels(c, num(f, "id")));
export const restore = action("operator", (c, f) => restoreLabels(c, num(f, "id")));

/** One click: a job to this computer's printer for its kind. The dialog route opens the print view instead. */
export async function printNow(id: number) {
  return action("operator", (c) => printJob(c, id))({}, new FormData());
}

async function printJob(c: ActionCtx, id: number) {
  const job = await jobById(c.db, c.companyId, id);
  const w = await ensureWorkstation(c.db, c.companyId, c.userId);
  const t = await targetFor(c.db, c.companyId, w.id, job.kind);
  if (!t.printer) throw new UserError("LBL-08", "Este equipo imprime con el diálogo: abre las etiquetas.");
  const r = await sendLabels(c, { source: `job:${job.id}`, printerId: t.printer.id, sizeId: t.sizeId, workstationId: w.id });
  return r.dialog ? undefined : r.message;
}
