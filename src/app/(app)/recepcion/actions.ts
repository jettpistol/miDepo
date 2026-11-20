"use server";

import { redirect } from "next/navigation";
import { action, num, txt } from "@/lib/action";
import { attempt, withCode } from "@/lib/errors";
import { requireSessionInAction } from "@/lib/session";
import { cancelReceiving, closeReceiving, createSupplier, createUnannouncedReceiving, deleteSupplier, reopenReceiving, scanReceiving, setReceived, setDamaged } from "@/lib/flows/receiving";

export const create = action("operator", async (c, f) => {
  const id = await createUnannouncedReceiving(c, num(f, "supplierId"));
  redirect(`/recepcion/${id}`);
});
export const scan = action("operator", (c, f) => scanReceiving(c, num(f, "id"), txt(f, "product"), f.get("quantity")));
export const correct = action("operator", (c, f) => setReceived(c, num(f, "id"), num(f, "productId"), f.get("received")));
export const correctDamaged = action("operator", (c, f) => setDamaged(c, num(f, "id"), num(f, "productId"), f.get("damaged")));
export const close = action("operator", (c, f) => closeReceiving(c, num(f, "id")));
export const cancel = action("operator", async (c, f) => {
  const message = await cancelReceiving(c, num(f, "id"));
  // One miDepo created no longer exists: back to the list. One Fierro announced stays.
  if (f.get("unannounced")) redirect("/recepcion");
  return message;
});
export const reopen = action("operator", (c, f) => reopenReceiving(c, num(f, "id")));
export const removeSupplier = action("supervisor", async (c, f) => {
  await deleteSupplier(c, num(f, "id"));
  redirect("/proveedores");
});

/** Creates a supplier from the dropdown's "Crear proveedor" choice and returns it as an option. Supervisors and above only. */
export async function addSupplier(name: string): Promise<{ value: string; label: string } | { error: string }> {
  let created: { id: number; name: string } | undefined;
  const r = await attempt(async () => {
    const s = await requireSessionInAction("supervisor");
    created = await createSupplier({ db: s.db, companyId: s.company.id, userId: s.user.id }, name);
  });
  return created ? { value: String(created.id), label: created.name } : { error: r.error ?? withCode("No se pudo crear el proveedor.", "RCV-11") };
}
