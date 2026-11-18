"use server";

import { redirect } from "next/navigation";
import { action, num, txt } from "@/lib/action";
import { closeCount, createCount, scanCount, setCounted, markLocation, requestRecount } from "@/lib/flows/counts";

export const create = action("supervisor", async (c, f) => {
  const id = await createCount(c, txt(f, "name"), txt(f, "prefix"));
  redirect(`/conteos/${id}`);
});
export const scan = action("operator", (c, f) => scanCount(c, num(f, "id"), num(f, "locationId"), txt(f, "product"), f.get("quantity")));
export const correct = action("operator", (c, f) => setCounted(c, num(f, "id"), num(f, "locationId"), num(f, "productId"), f.get("countedQty")));
export const complete = action("operator", async (c, f) => {
  await markLocation(c, num(f, "id"), num(f, "locationId"), true);
  redirect(`/conteos/${num(f, "id")}`);
});
export const reopen = action("supervisor", (c, f) => markLocation(c, num(f, "id"), num(f, "locationId"), false));
export const approve = action("supervisor", (c, f) => closeCount(c, num(f, "id"), txt(f, "cause") || "count_difference"));
export const recount = action("supervisor", (c, f) => requestRecount(c, num(f, "id"), num(f, "locationId")));
