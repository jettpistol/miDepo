"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { notifications } from "@/db/schema";
import { action } from "@/lib/action";
import { requireSessionInAction } from "@/lib/session";

/** Opens a notice: marks it read and goes where it points. */
export async function openNotice(f: FormData) {
  const s = await requireSessionInAction();
  const [n] = await s.db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, Number(f.get("id"))), eq(notifications.userId, s.user.id)))
    .returning({ href: notifications.href });
  revalidatePath("/", "layout");
  // Only paths inside the app are followed.
  redirect(n?.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/avisos");
}

export const markAllRead = action("operator", async (c) => {
  await c.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, c.userId), isNull(notifications.readAt)));
  return "Leídos.";
});
