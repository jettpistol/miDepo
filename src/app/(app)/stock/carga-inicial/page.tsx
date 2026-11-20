import { ActionButton } from "@/components/ScanForm";
import { Badge, EmptyRow, PageHeader, plural, shortDate } from "@/components/ui";
import { InfoHint } from "@/components/Hint";
import { listLoads } from "@/lib/flows/stockLoad";
import { requireSession } from "@/lib/session";
import { LoadForm } from "./LoadForm";
import { undo } from "./actions";

export const metadata = { title: "Stock inicial" };

export default async function StockLoad() {
  const { db, company } = await requireSession("admin");
  const loads = await listLoads(db, company.id);
  return (
    <>
      <PageHeader title="Stock inicial" back={{ href: "/stock", text: "Stock" }} />
      <section className="mb-8">
        <h2 className="section-title">
          Subir archivo{" "}
          <InfoHint text="CSV con tres columnas: código (de barras, ISBN o SKU), cantidad y ubicación. La primera fila puede ser el encabezado. Separador: coma, punto y coma o tabulación." />
        </h2>
        {/* Remounted after each load, so the same file is not loaded twice by accident. */}
        <LoadForm key={loads.length} />
      </section>
      <section>
        <h2 className="section-title">
          Cargas <small>{loads.length}</small>
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Carga</th>
                <th className="hidden sm:table-cell">Archivo</th>
                <th className="text-right">Unidades</th>
                <th className="hidden md:table-cell">Usuario</th>
                <th className="hidden sm:table-cell">Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loads.length === 0 && <EmptyRow columns={6} title="Sin cargas" />}
              {loads.map(({ l, by }) => (
                <tr key={l.id}>
                  <td className="doc-number">{l.number}</td>
                  <td className="hidden max-w-0 truncate text-muted sm:table-cell">{l.fileName ?? "—"}</td>
                  <td className="text-right font-semibold tabular-nums">{l.units}</td>
                  <td className="hidden md:table-cell">{by}</td>
                  <td className="hidden whitespace-nowrap text-muted sm:table-cell">{shortDate(l.createdAt)}</td>
                  <td className="w-px text-right">
                    {l.undoneAt ? (
                      <Badge>Deshecha</Badge>
                    ) : (
                      <ActionButton action={undo} hiddenFields={{ id: l.id }} className="btn-soft btn-sm" confirm={`¿Deshacer la carga ${l.number}? ${plural(l.units, "unidad sale", "unidades salen")} del stock. Solo funciona si nada de esa carga se movió.`}>
                        Deshacer
                      </ActionButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
