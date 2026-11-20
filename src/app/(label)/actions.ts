"use server";

import { revalidatePath } from "next/cache";
import { attempt } from "@/lib/errors";
import type { LabelKind } from "@/lib/labels/kinds";
import { assignPrinter, sendLabels } from "@/lib/flows/printers";
import { requireSessionInAction } from "@/lib/session";
import { ensureWorkstation } from "@/lib/workstation";

export type SendResult = { ok?: string; error?: string; dialog?: boolean };

/** Prints a print view's labels on the chosen printer and size. For the dialog, the page then prints itself. */
export async function send(source: string, printerId: number | null, sizeId: string): Promise<SendResult> {
  let dialog = false;
  const r = await attempt(async () => {
    const s = await requireSessionInAction();
    const w = await ensureWorkstation(s.db, s.company.id, s.user.id);
    const sent = await sendLabels({ db: s.db, companyId: s.company.id, userId: s.user.id, company: s.company }, { source, printerId, sizeId, workstationId: w.id });
    revalidatePath("/", "layout");
    dialog = sent.dialog;
    return sent.dialog ? undefined : sent.message;
  });
  return r.error ? { error: r.error } : dialog ? { dialog: true } : { ok: r.ok };
}

/** Keeps a printer and size as this computer's choice for a kind of label (supervisors). */
export async function keepForComputer(kind: LabelKind, printerId: number | null, sizeId: string) {
  return attempt(async () => {
    const s = await requireSessionInAction("supervisor");
    const w = await ensureWorkstation(s.db, s.company.id, s.user.id);
    return assignPrinter({ db: s.db, companyId: s.company.id, userId: s.user.id }, w.id, kind, printerId, sizeId);
  });
}
