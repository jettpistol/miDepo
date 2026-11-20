"use server";

import { action, num, txt } from "@/lib/action";
import { attempt, withCode } from "@/lib/errors";
import { createCarrier, loadBox, setShipping, unloadBox } from "@/lib/flows/dispatch";
import { requireSessionInAction } from "@/lib/session";

export const load = action("operator", (c, f) => loadBox(c, txt(f, "box")));
export const unload = action("operator", (c, f) => unloadBox(c, num(f, "boxId")));
export const shipping = action("operator", (c, f) => setShipping(c, num(f, "id"), { carrierId: num(f, "carrierId"), tracking: txt(f, "tracking"), remito: txt(f, "remito") }));

/** Creates a carrier from the dropdown's "Crear transporte" choice and returns it as an option. Supervisors and above. */
export async function addCarrier(name: string): Promise<{ value: string; label: string } | { error: string }> {
  let created: { id: number; name: string } | undefined;
  const r = await attempt(async () => {
    const s = await requireSessionInAction("supervisor");
    created = await createCarrier({ db: s.db, companyId: s.company.id, userId: s.user.id }, name);
  });
  return created ? { value: String(created.id), label: created.name } : { error: r.error ?? withCode("No se pudo crear el transporte.", "DSP-14") };
}
