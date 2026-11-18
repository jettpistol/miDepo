import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ActionButton, ScanForm } from "@/components/ScanForm";
import { Code, PageHeader, ShelfMark } from "@/components/ui";
import { countLines, countLocations, counts, products, locations } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { EditNumber } from "../../../recepcion/[id]/EditNumber";
import { correct, scan, complete } from "../../actions";

export default async function CountLocation({ params }: { params: Promise<{ id: string; location: string }> }) {
  const { id: idText, location } = await params;
  const id = Number(idText);
  const locationId = Number(location);
  const { db, company } = await requireSession();
  const [row] = await db
    .select({ k: counts, u: countLocations, code: locations.code })
    .from(countLocations)
    .innerJoin(counts, eq(counts.id, countLocations.countId))
    .innerJoin(locations, eq(locations.id, countLocations.locationId))
    .where(and(eq(countLocations.countId, id), eq(countLocations.locationId, locationId), eq(counts.companyId, company.id)));
  if (!row) notFound();
  const lines = await db.select({ l: countLines, title: products.title, code: products.barcode }).from(countLines).innerJoin(products, eq(products.id, countLines.productId)).where(and(eq(countLines.countId, id), eq(countLines.locationId, locationId))).orderBy(asc(products.title));
  const open = row.k.status === "open" && row.u.status === "pending";

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Contar <ShelfMark code={row.code} size="md" className="text-[22px] lg:text-2xl" />
          </span>
        } back={{ href: `/conteos/${id}`, text: row.k.name }} />
      <div className={open ? "grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-8" : "max-w-3xl"}>
        {open && (
          <div className="space-y-3 lg:sticky lg:top-30">
            <ScanForm action={scan} context="count" hiddenFields={{ id, locationId }} fields={[{ name: "product", label: "Libro", help: "Código, título o autor" }]} quantity={1} button="Sumar" />
            <ActionButton action={complete} hiddenFields={{ id, locationId }} className="btn-soft w-full" confirm={lines.length === 0 ? `¿Confirmas que ${row.code} está vacía?` : `¿Ya contaste todo lo que hay en ${row.code}?`} showOk={false}>
              {lines.length === 0 ? "Está vacía" : "Terminar esta ubicación"}
            </ActionButton>
          </div>
        )}
        {lines.length === 0 ? (
          <p className="border-y border-line px-2 py-8 text-sm text-muted lg:px-3">Todavía no contaste nada acá.</p>
        ) : (
          <ul className="ruled-list framed">
            {lines.map(({ l, title, code }) => (
              <li key={l.productId} className="row justify-between">
                <span className="min-w-0">
                  <span className="block font-medium">{title}</span>
                  <Code>{code}</Code>
                </span>
                {open ? <EditNumber action={correct} hiddenFields={{ id, locationId, productId: l.productId }} field="countedQty" value={l.countedQty} /> : <span className="text-base font-semibold tabular-nums">{l.countedQty}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
