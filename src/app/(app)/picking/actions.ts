"use server";

import { redirect } from "next/navigation";
import { action, num, txt } from "@/lib/action";
import { can } from "@/lib/session";
import { confirmPick, markShort, releaseOrder, takeOrder, undoShort, unpick } from "@/lib/flows/picking";

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
