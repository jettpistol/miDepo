"use server";

import { redirect } from "next/navigation";
import { action, num, txt } from "@/lib/action";
import { can } from "@/lib/session";
import { confirmBatchPick, confirmPick, markBatchShort, markShort, releaseBatch, releaseOrder, takeAll, takeOrder, undoBatchShort, undoShort, unpick, unpickBatchStop } from "@/lib/flows/picking";

export const take = action("operator", async (c, f) => {
  await takeOrder(c, num(f, "id"));
  redirect(`/picking/${num(f, "id")}`);
});
export const confirm = action("operator", (c, f) => confirmPick(c, { taskId: num(f, "taskId"), location: txt(f, "location"), product: txt(f, "product"), quantity: f.get("quantity") }));
export const shortage = action("operator", (c, f) => markShort(c, num(f, "taskId")));
export const putBack = action("operator", (c, f) => unpick(c, num(f, "taskId")));
export const wasThere = action("operator", (c, f) => undoShort(c, num(f, "taskId")));
export const release = action("operator", async (c, f) => {
  await releaseOrder(c, num(f, "id"), { anyone: can(c.user.role, "supervisor") });
  redirect(`/picking?soltado=${num(f, "id")}`);
});

export const takeAllOrders = action("operator", async (c) => {
  const batch = await takeAll(c);
  redirect(`/picking/lote/${batch.id}`);
});
const stop = (f: FormData) => ({ batchId: num(f, "batchId"), locationId: num(f, "locationId"), productId: num(f, "productId") });
export const confirmBatch = action("operator", (c, f) => confirmBatchPick(c, { ...stop(f), location: txt(f, "location"), product: txt(f, "product"), quantity: f.get("quantity") }));
export const shortageBatch = action("operator", (c, f) => markBatchShort(c, stop(f)));
export const putBackBatch = action("operator", (c, f) => unpickBatchStop(c, stop(f)));
export const wasThereBatch = action("operator", (c, f) => undoBatchShort(c, stop(f)));
export const releaseBatchAction = action("operator", async (c, f) => {
  await releaseBatch(c, num(f, "batchId"), { anyone: can(c.user.role, "supervisor") });
  redirect("/picking");
});
