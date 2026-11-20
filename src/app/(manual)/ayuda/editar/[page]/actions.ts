"use server";

import { redirect } from "next/navigation";
import { action, txt } from "@/lib/action";
import { restoreOriginal, saveEdit } from "@/lib/wiki";

export const savePage = action("admin", async (c, f) => {
  const page = txt(f, "page");
  await saveEdit(c, page, txt(f, "markdown"));
  redirect(`/ayuda/${page}`);
});

export const restorePage = action("admin", async (c, f) => {
  const page = txt(f, "page");
  await restoreOriginal(c, page);
  redirect(`/ayuda/${page}`);
});
