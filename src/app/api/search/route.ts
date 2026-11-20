import { getDb } from "@/db";
import { searchFeatures, type Feature } from "@/lib/search/functions";
import { searchInventory, type InventoryHit } from "@/lib/search/inventory";
import { searchSections, type SectionHit } from "@/lib/wiki";
import { currentSession } from "@/lib/session";

export type SearchResults = { funciones: Omit<Feature, "words" | "minRole">[]; inventario: InventoryHit[]; guias: SectionHit[] };

/** The top search: functions the user may use, inventory of their company, and the manual. */
export async function GET(request: Request) {
  const s = await currentSession();
  if (!s) return new Response(null, { status: 401 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const inventario = await searchInventory(await getDb(), s.company.id, q);
  const body: SearchResults = {
    funciones: searchFeatures(q, s.user.role).map(({ words: _w, minRole: _r, ...f }) => f),
    inventario,
    guias: searchSections(q),
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
