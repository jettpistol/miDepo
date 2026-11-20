"use server";

import { redirect } from "next/navigation";
import { action, num, txt } from "@/lib/action";
import { confirmBatchPick, confirmPick, markBatchShort, markShort, takeAll, takeOrder } from "@/lib/flows/picking";

export const take = action("operator", async (c, f) => {
  await takeOrder(c, num(f, "id"));
  redirect(`/picking/${num(f, "id")}`);
});
export const confirm = action("operator", (c, f) => confirmPick(c, { taskId: num(f, "taskId"), location: txt(f, "location"), product: txt(f, "product"), quantity: f.get("quantity") }));
export const shortage = action("operator", (c, f) => markShort(c, num(f, "taskId")));

export const takeAllOrders = action("operator", async (c) => {
  const batch = await takeAll(c);
  redirect(`/picking/lote/${batch.id}`);
});
const stop = (f: FormData) => ({ batchId: num(f, "batchId"), locationId: num(f, "locationId"), productId: num(f, "productId") });
export const confirmBatch = action("operator", (c, f) => confirmBatchPick(c, { ...stop(f), location: txt(f, "location"), product: txt(f, "product"), quantity: f.get("quantity") }));
export const shortageBatch = action("operator", (c, f) => markBatchShort(c, stop(f)));
