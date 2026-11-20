import { Icon } from "@/components/Icon";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { Badge, EmptyRow, PageHeader, shortDate } from "@/components/ui";
import { EXPORT_NAME, sentExports } from "@/lib/flows/exports";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Cargados en Fierro" };

export default async function Loaded({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { db, company } = await requireSession("supervisor");
  const page = requestedPage((await searchParams).pagina);
  const { total, rows } = await sentExports(db, company.id, paging(page));

  return (
    <>
      <PageHeader title="Cargados en Fierro" back={{ href: "/fierro", text: "Fierro" }} />
      <h2 className="section-title">
        Documentos <small>{total}</small>
      </h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th className="hidden sm:table-cell">Tipo</th>
              <th className="hidden md:table-cell">Detalle</th>
              <th className="hidden sm:table-cell">Cargado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow columns={5} title="Todavía no se marcó nada como cargado" />}
            {rows.map((d) => (
              <tr key={`${d.type}-${d.id}`}>
                <td>
                  <span className="doc-number">{d.number}</span>
                  <span className="mt-1 block sm:hidden">
                    <Badge>{EXPORT_NAME[d.type]}</Badge>
                  </span>
                  <span className="block max-w-44 truncate text-muted sm:max-w-64 md:hidden">{d.detail}</span>
                  <span className="block text-muted sm:hidden">Cargado {shortDate(d.sent)}</span>
                </td>
                <td className="hidden sm:table-cell">
                  <Badge>{EXPORT_NAME[d.type]}</Badge>
                </td>
                <td className="hidden text-muted md:table-cell">{d.detail}</td>
                <td className="hidden whitespace-nowrap text-muted sm:table-cell">{shortDate(d.sent)}</td>
                <td className="w-px">
                  <a href={`/api/export/${d.type}/${d.id}`} className="btn-sm" download>
                    <Icon name="download" className="size-4" /> CSV
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/fierro/cargados" params={{}} page={page} total={total} />
    </>
  );
}
