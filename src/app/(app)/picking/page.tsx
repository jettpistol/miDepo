import { PageHeader, EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { BatchesTable, InProgressTable, loadOpenOrders, PendingTable, TakeAllButton } from "./Tables";

export const metadata = { title: "Picking" };

export default async function Picking() {
  const { db, company, user } = await requireSession();
  const { inProgress, pending, batches } = await loadOpenOrders(db, company.id);

  return (
    <>
      <PageHeader title="Picking" />

      {batches.length > 0 && (
        <section className="mb-8 lg:mb-6">
          <h2 className="section-title">
            Lotes en preparación <small>{batches.length}</small>
          </h2>
          <BatchesTable rows={batches} userId={user.id} />
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="mb-8 lg:mb-6">
          <h2 className="section-title">
            En preparación <small>{inProgress.length}</small>
          </h2>
          <InProgressTable rows={inProgress} userId={user.id} />
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h2 className="section-title mb-0">
            Pendientes <small>{pending.length}</small>
          </h2>
          {pending.length > 0 && <TakeAllButton count={pending.length} />}
        </div>
        {pending.length === 0 ? <EmptyState title="No hay pedidos pendientes">Los pedidos nuevos aparecen cuando se sincroniza con Fierro.</EmptyState> : <PendingTable rows={pending} />}
      </section>
    </>
  );
}
