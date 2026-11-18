import { getDb } from "@/db";
import { runLookup } from "@/lib/lookup";
import { currentSession } from "@/lib/session";

/** Rehearsal of a scan form: what is fine, what is not, and what to suggest. Changes nothing. */
export async function GET(order: Request) {
  const s = await currentSession();
  if (!s) return new Response(null, { status: 401 });
  const result = await runLookup(await getDb(), s.company.id, new URL(order.url).searchParams);
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
