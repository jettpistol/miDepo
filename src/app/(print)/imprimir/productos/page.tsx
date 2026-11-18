import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { products } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { Labels } from "../../Labels";

/** Labels for items without an ISBN (floppies, variants, packs): they carry the internal code. */
export default async function ProductLabels({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db, company } = await requireSession();
  const q = ((await searchParams).q ?? "").trim().replace(/[%_\\]/g, "");
  const rows = q
    ? await db
        .select({ code: products.barcode, title: products.title })
        .from(products)
        .where(and(eq(products.companyId, company.id), isNull(products.isbn), ilike(products.title, `%${q.split(/\s+/).join("%")}%`)))
        .orderBy(asc(products.title))
        .limit(240)
    : [];
  return (
    <>
      <form className="no-print mb-4 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por título (solo artículos sin ISBN)" className="w-full rounded-lg border border-neutral-400 px-3 py-2" />
        <button className="rounded-lg border border-neutral-400 px-3 py-2 font-semibold">Buscar</button>
      </form>
      {q ? <Labels items={rows} /> : <p className="py-10 text-center">Buscá una serie o un título para armar sus etiquetas.</p>}
    </>
  );
}
