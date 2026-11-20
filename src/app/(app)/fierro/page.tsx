import Link from "next/link";
import { ActionButton } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { Notice, PageHeader, shortDate, Badge, EmptyState } from "@/components/ui";
import { connector } from "@/lib/fierro";
import { EXPORT_NAME, pendingExports } from "@/lib/flows/exports";
import { requireSession } from "@/lib/session";
import { submit, simulate, syncNow } from "./actions";
import { InfoHint } from "@/components/Hint";

export const metadata = { title: "Fierro" };

export default async function Fierro() {
  const { db, company } = await requireSession("supervisor");
  const pending = await pendingExports(db, company.id);
  const simulated = connector(db, company).mode === "simulated";

  return (
    <>
      <PageHeader title="Fierro">
        <Link href="/fierro/conciliacion" className="btn-soft">
          Conciliar stock
        </Link>
      </PageHeader>

      {simulated && (
        <div className="mb-6">
          <Notice tone="warn">
            <strong>Modo de prueba:</strong> este depósito está conectado a un Fierro simulado con datos inventados. Nada de lo que hagas aquí llega a un Fierro real.
          </Notice>
        </div>
      )}

      <section className="mb-8 lg:mb-6">
        <h2 className="section-title">Traer novedades de Fierro</h2>
        <p className="mb-3 max-w-[70ch] text-sm text-muted">Última sincronización: {company.lastSync ? shortDate(company.lastSync) : "nunca"}</p>
        <div className="flex flex-wrap gap-2">
          <ActionButton action={syncNow}>
            <Icon name="fierro" /> Sincronizar ahora
          </ActionButton>
          {simulated && (
            <>
              <ActionButton action={simulate} hiddenFields={{ what: "orders", howManyOf: 10 }} className="btn-soft">
                Simular 10 pedidos nuevos
              </ActionButton>
              <ActionButton action={simulate} hiddenFields={{ what: "receipts", howManyOf: 1 }} className="btn-soft">
                Simular una recepción avisada
              </ActionButton>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">
          Para cargar en Fierro <small>{pending.length}</small>
          <InfoHint text="Un pedido sale del stock solo cuando lo marcas como cargado." />
        </h2>
        {pending.length === 0 ? (
          <EmptyState title="Fierro está al día">No hay documentos del depósito sin cargar.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th className="hidden sm:table-cell">Tipo</th>
                  <th className="hidden md:table-cell">Detalle</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={`${p.type}-${p.id}`}>
                    <td>
                      <span className="doc-number">{p.number}</span>
                      <span className="mt-1 block sm:hidden">
                        <Badge tone="accent">{EXPORT_NAME[p.type]}</Badge>
                      </span>
                      <span className="block max-w-44 truncate text-muted sm:max-w-64 md:hidden">{p.detail}</span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <Badge tone="accent">{EXPORT_NAME[p.type]}</Badge>
                    </td>
                    <td className="hidden text-muted md:table-cell">{p.detail}</td>
                    <td className="w-px">
                      <span className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                        <a href={`/api/export/${p.type}/${p.id}`} className="btn-sm" download>
                          <Icon name="download" className="size-4" /> CSV
                        </a>
                        <ActionButton action={submit} hiddenFields={{ type: p.type, id: p.id }} className="btn-sm" confirm={`¿Ya cargaste ${p.number} en Fierro?`}>
                          Marcar como cargado
                        </ActionButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
