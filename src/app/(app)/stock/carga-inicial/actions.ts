"use server";

import { action, num, txt } from "@/lib/action";
import { attempt } from "@/lib/errors";
import { applyLoad, checkLoad, undoLoad, type LoadCheck } from "@/lib/flows/stockLoad";
import { requireSessionInAction } from "@/lib/session";

/** Checks the file row by row and changes nothing. Administrators only. */
export async function check(text: string): Promise<LoadCheck | { error: string }> {
  let result: LoadCheck | undefined;
  const r = await attempt(async () => {
    const s = await requireSessionInAction("admin");
    result = await checkLoad(s.db, s.company.id, text);
  });
  return result ?? { error: r.error ?? "" };
}

export const load = action("admin", (c, f) => applyLoad(c, txt(f, "text"), txt(f, "fileName") || null));
export const undo = action("admin", (c, f) => undoLoad(c, num(f, "id")));
