"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { users } from "@/db/schema";
import { requireSessionInAction } from "@/lib/session";

/** Remembers how this person wants product lists: the table (default) or cards with covers. */
export async function setListView(f: FormData) {
  const s = await requireSessionInAction("operator");
  const view = f.get("view") === "cards" ? "cards" : "table";
  await s.db.update(users).set({ listView: view }).where(eq(users.id, s.user.id));
  revalidatePath("/", "layout");
}
