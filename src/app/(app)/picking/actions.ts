"use server";

import { redirect } from "next/navigation";
import { action, num, txt } from "@/lib/action";
import { confirmPick, markShort, takeOrder } from "@/lib/flows/picking";

export const take = action("operator", async (c, f) => {
  await takeOrder(c, num(f, "id"));
  redirect(`/picking/${num(f, "id")}`);
});
export const confirm = action("operator", (c, f) => confirmPick(c, { taskId: num(f, "taskId"), location: txt(f, "location"), product: txt(f, "product"), quantity: f.get("quantity") }));
export const shortage = action("operator", (c, f) => markShort(c, num(f, "taskId")));
