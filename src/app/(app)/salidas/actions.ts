"use server";

import { redirect } from "next/navigation";
import { action, num, txt } from "@/lib/action";
import { attempt, withCode } from "@/lib/errors";
import { closeTransfer, createOutsideLocation, createTransfer, receiveBack, sendItem, sendTransfer, unsendItem } from "@/lib/flows/transfers";
import { requireSessionInAction } from "@/lib/session";

export const create = action("operator", async (c, f) => {
  const id = await createTransfer(c, num(f, "locationId"));
  redirect(`/salidas/${id}`);
});
export const send = action("operator", (c, f) => sendItem(c, num(f, "id"), { source: txt(f, "source"), product: txt(f, "product"), quantity: f.get("quantity") }));
export const unsend = action("operator", (c, f) => unsendItem(c, num(f, "id"), num(f, "productId")));
export const leave = action("operator", (c, f) => sendTransfer(c, num(f, "id"), txt(f, "remito")));
export const back = action("operator", (c, f) => receiveBack(c, num(f, "id"), { product: txt(f, "product"), quantity: f.get("quantity") }));
export const close = action("supervisor", (c, f) => closeTransfer(c, num(f, "id")));

/** Creates an outside location from the dropdown's "Crear destino" choice. Supervisors and above. */
export async function addDestination(name: string): Promise<{ value: string; label: string } | { error: string }> {
  let created: { id: number; code: string; name: string | null } | undefined;
  const r = await attempt(async () => {
    const s = await requireSessionInAction("supervisor");
    created = await createOutsideLocation({ db: s.db, companyId: s.company.id, userId: s.user.id }, name);
  });
  return created ? { value: String(created.id), label: created.name ?? created.code } : { error: r.error ?? withCode("No se pudo crear el destino.", "TRF-15") };
}
