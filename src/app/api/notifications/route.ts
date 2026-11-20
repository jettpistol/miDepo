import { getDb } from "@/db";
import { inbox, runTimedChecks } from "@/lib/notifications";
import { currentSession } from "@/lib/session";

/** What the bell shows: unread count and the latest notices. Also runs the clock-based checks. */
export async function GET() {
  const s = await currentSession();
  if (!s) return new Response(null, { status: 401 });
  const db = await getDb();
  await runTimedChecks(db, s.company.id);
  return Response.json(await inbox(db, s.user.id), { headers: { "cache-control": "no-store" } });
}
