"use server";

import { action, num, txt } from "@/lib/action";
import { attempt } from "@/lib/errors";
import { assignPrinter, createPrinter, renameWorkstation, setDemoFault, setPrinterActive } from "@/lib/flows/printers";
import { requireSessionInAction } from "@/lib/session";
import { ensureWorkstation } from "@/lib/workstation";
import { revalidatePath } from "next/cache";

/** This computer's printer and size for a kind of label. Saved on each change. */
export async function assign(kind: string, printerId: number | null, sizeId: string) {
  return attempt(async () => {
    const s = await requireSessionInAction("supervisor");
    const c = { db: s.db, companyId: s.company.id, userId: s.user.id };
    const w = await ensureWorkstation(s.db, s.company.id, s.user.id);
    const r = await assignPrinter(c, w.id, kind, printerId, sizeId);
    revalidatePath("/", "layout");
    return r;
  });
}

export const rename = action("supervisor", async (c, f) => {
  const w = await ensureWorkstation(c.db, c.companyId, c.userId);
  return renameWorkstation(c, w.id, txt(f, "name"));
});
export const newPrinter = action("supervisor", (c, f) => createPrinter(c, { name: txt(f, "name"), modelId: txt(f, "model") }));
export const deactivate = action("supervisor", (c, f) => setPrinterActive(c, num(f, "id"), false));
export const reactivate = action("supervisor", (c, f) => setPrinterActive(c, num(f, "id"), true));
export async function fault(id: number, value: string) {
  return attempt(async () => {
    const s = await requireSessionInAction("supervisor");
    const r = await setDemoFault({ db: s.db, companyId: s.company.id, userId: s.user.id }, id, value);
    revalidatePath("/", "layout");
    return r;
  });
}
