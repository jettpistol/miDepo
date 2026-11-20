"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { users } from "@/db/schema";
import { requireSessionInAction } from "@/lib/session";

/** Remembers how this person wants product lists: cards with covers, or the table. */
export async function setListView(f: FormData) {
  const s = await requireSessionInAction("operator");
  const view = f.get("view") === "table" ? "table" : "cards";
  await s.db.update(users).set({ listView: view }).where(eq(users.id, s.user.id));
  revalidatePath("/", "layout");
}
