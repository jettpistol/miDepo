"use server";

import { redirect } from "next/navigation";
import { action, num, txt } from "@/lib/action";
import { cancelReturn, closeReturn, createReturn, reopenReturn, scanReturn, removeReturnLine } from "@/lib/flows/returns";

export const create = action("operator", async (c, f) => {
  const id = await createReturn(c, num(f, "customerId"));
  redirect(`/devoluciones/${id}`);
});
export const scan = action("operator", (c, f) => scanReturn(c, num(f, "id"), txt(f, "product"), txt(f, "bookCondition"), f.get("quantity")));
export const remove = action("operator", (c, f) => removeReturnLine(c, num(f, "id"), num(f, "productId"), txt(f, "bookCondition")));
export const close = action("operator", (c, f) => closeReturn(c, num(f, "id")));
export const cancel = action("operator", async (c, f) => {
  await cancelReturn(c, num(f, "id"));
  redirect("/devoluciones");
});
export const reopen = action("operator", (c, f) => reopenReturn(c, num(f, "id")));
