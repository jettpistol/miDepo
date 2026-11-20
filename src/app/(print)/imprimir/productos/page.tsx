import { and, asc, eq, gt, ilike, isNull } from "drizzle-orm";
import { products, receivingLines, receivings } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { Labels } from "../../Labels";
import { Icon } from "@/components/Icon";

const MAX_LABELS = 240;

/**
 * Labels for items without an ISBN (floppies, variants, packs): they carry the internal code.
 * With ?recepcion=<id>, one label per unit received there, ISBN or not: for covers the scanner
 * cannot read, or reprints that share an ISBN, labelled at the receiving table.
 */
export default async function ProductLabels({ searchParams }: { searchParams: Promise<{ q?: string; recepcion?: string }> }) {
  const { db, company } = await requireSession();
  const sp = await searchParams;
  const receivingId = Number(sp.recepcion);
  if (Number.isInteger(receivingId) && receivingId > 0) {
    const lines = await db
      .select({ code: products.barcode, title: products.title, n: receivingLines.received })
      .from(receivingLines)
      .innerJoin(receivings, eq(receivings.id, receivingLines.receivingId))
      .innerJoin(products, eq(products.id, receivingLines.productId))
      .where(and(eq(receivings.id, receivingId), eq(receivings.companyId, company.id), gt(receivingLines.received, 0)))
      .orderBy(asc(products.title));
    const items = lines.flatMap((l) => Array.from({ length: l.n }, () => ({ code: l.code, title: l.title }))).slice(0, MAX_LABELS);
    return items.length > 0 ? <Labels items={items} /> : <p className="py-10 text-center">Sin unidades recibidas.</p>;
  }
  const q = (sp.q ?? "").trim().replace(/[%_\\]/g, "");
  const rows = q
    ? await db
        .select({ code: products.barcode, title: products.title })
        .from(products)
        .where(and(eq(products.companyId, company.id), isNull(products.isbn), ilike(products.title, `%${q.split(/\s+/).join("%")}%`)))
        .orderBy(asc(products.title))
        .limit(MAX_LABELS)
    : [];
  return (
    <>
      <form className="field-group search-box no-print mb-4" role="search">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre (solo artículos sin ISBN)" aria-label="Buscar por nombre" className="field" />
        <button className="btn" aria-label="Buscar">
          <Icon name="stock" />
        </button>
      </form>
      {q ? <Labels items={rows} /> : <p className="py-10 text-center">Busca una serie o un artículo para generar sus etiquetas.</p>}
    </>
  );
}
