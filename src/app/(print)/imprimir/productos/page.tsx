import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { products } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { Labels } from "../../Labels";
import { Icon } from "@/components/Icon";

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
      <form className="field-group no-print mb-4" role="search">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre (solo artículos sin ISBN)" aria-label="Buscar por nombre" className="field" />
        <button className="btn" aria-label="Buscar">
          <Icon name="stock" />
        </button>
      </form>
      {q ? <Labels items={rows} /> : <p className="py-10 text-center">Busca una serie o un artículo para generar sus etiquetas.</p>}
    </>
  );
}
