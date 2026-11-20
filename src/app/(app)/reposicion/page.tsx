import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ScanForm } from "@/components/ScanForm";
import { Code, PageHeader, ShelfMark, EmptyState } from "@/components/ui";
import { products, stock, locations } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { moveAction } from "../mover/actions";
import { hotkey } from "@/lib/hotkeys";
import { Assignee } from "@/components/Assignee";

export const metadata = { title: "Reposición" };

export default async function PutAway({ searchParams }: { searchParams: Promise<{ zona?: string }> }) {
  const session = await requireSession();
  const { db, company } = session;
  const zone = (await searchParams).zona === "devoluciones" ? "returns" : "receiving";
  const zones = await db.select().from(locations).where(and(eq(locations.companyId, company.id), inArray(locations.type, ["receiving", "returns"])));
  const current = zones.find((z) => z.type === zone);

  const pending = current
    ? await db
        .select({ productId: stock.productId, quantity: stock.quantity, title: products.title, code: products.barcode })
        .from(stock)
        .innerJoin(products, eq(products.id, stock.productId))
        .where(eq(stock.locationId, current.id))
        .orderBy(asc(products.title))
        .limit(300)
    : [];

  // Suggestion: the shelf where that title already has the most units, so it does not get scattered.
  const suggestions = new Map<number, string>();
  if (pending.length > 0) {
    const whereabouts = await db
      .select({ productId: stock.productId, code: locations.code })
      .from(stock)
      .innerJoin(locations, eq(locations.id, stock.locationId))
      .where(and(eq(stock.companyId, company.id), eq(locations.type, "shelf"), inArray(stock.productId, pending.map((p) => p.productId))))
      .orderBy(desc(stock.quantity));
    for (const d of whereabouts) if (!suggestions.has(d.productId)) suggestions.set(d.productId, d.code);
  }
  const units = pending.reduce((s, p) => s + p.quantity, 0);

  return (
    <>
      <PageHeader title="Reposición">{current && <Assignee session={session} kind="putaway" id={current.id} value={current.assignedTo} />}</PageHeader>
      <div className="mb-6 flex gap-5 border-b border-line">
        {(["receiving", "returns"] as const).map((z) => (
          <Link key={z} href={z === "receiving" ? "/reposicion" : "/reposicion?zona=devoluciones"} aria-current={zone === z ? "page" : undefined} {...(zone !== z ? hotkey("secondary", z === "receiving" ? "Ver desde Recepción" : "Ver desde Devoluciones") : {})} className={`-mb-px border-b-2 px-0.5 py-2 text-sm transition-colors duration-150 ${zone === z ? "border-accent-text font-bold text-accent-text" : "border-transparent font-medium text-muted hover:text-ink"}`}>
            {z === "receiving" ? "Desde Recepción" : "Desde Devoluciones"}
          </Link>
        ))}
      </div>

      {pending.length === 0 ? (
        <EmptyState title="No queda nada por guardar acá">Lo que cierres en {zone === "receiving" ? "una recepción" : "una devolución (los libros vendibles)"} va a aparecer en esta lista.</EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-8">
          <div className="lg:sticky lg:top-30">
            <ScanForm
              action={moveAction}
              context="putaway"
              hiddenFields={{ source: current!.code }}
              fields={[
                { name: "product", label: "Libro" },
                { name: "destination", label: "Estante", help: "Escanea el cartel" },
              ]}
              quantity={1}
              button="Guardar"
            />
          </div>
          <div className="min-w-0">
            <p className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-sm text-muted">
              <span>
                Quedan <strong className="text-ink">{units} unidades</strong> de {pending.length} títulos.
              </span>
              <ShelfMark code={current!.code} />
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th className="text-right">Por guardar</th>
                    <th>Ya hay en</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.productId}>
                      <td>
                        <span className="block font-medium">{p.title}</span>
                        <Code>{p.code}</Code>
                      </td>
                      <td className="text-right text-base font-bold">{p.quantity}</td>
                      <td>{suggestions.has(p.productId) ? <ShelfMark code={suggestions.get(p.productId)} size="md" /> : <span className="text-muted">Título nuevo: elige un estante libre</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
