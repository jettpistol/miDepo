import { revalidatePath } from "next/cache";
import type { Role, users } from "@/db/schema";
import { attempt, type Result } from "./errors";
import type { Company } from "./fierro";
import type { Ctx } from "./flows/common";
import { requireSessionInAction } from "./session";

export type ActionCtx = Ctx & { company: Company; user: typeof users.$inferSelect };

/**
 * Builds a server action: requires a session and a role, turns errors into messages and
 * refreshes the screens. Whatever `fn` returns is the success message.
 */
export function action(minRole: Role, fn: (c: ActionCtx, f: FormData) => Promise<string | void>) {
  return async (_: Result, f: FormData): Promise<Result> =>
    attempt(async () => {
      const s = await requireSessionInAction(minRole);
      const message = await fn({ db: s.db, companyId: s.company.id, userId: s.user.id, company: s.company, user: s.user }, f);
      revalidatePath("/", "layout");
      return message;
    });
}

export const num = (f: FormData, field: string) => Number(f.get(field));
export const txt = (f: FormData, field: string) => String(f.get(field) ?? "");
