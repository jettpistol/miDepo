import { PageHeader, EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { InProgressTable, loadOpenOrders, PendingTable } from "./Tables";

export const metadata = { title: "Picking" };

export default async function Picking() {
  const { db, company, user } = await requireSession();
  const { inProgress, pending } = await loadOpenOrders(db, company.id);

  return (
    <>
      <PageHeader title="Picking" />

      {inProgress.length > 0 && (
        <section className="mb-8 lg:mb-6">
          <h2 className="section-title">
            En preparación <small>{inProgress.length}</small>
          </h2>
          <InProgressTable rows={inProgress} userId={user.id} />
        </section>
      )}

      <section>
        <h2 className="section-title">
          Pendientes <small>{pending.length}</small>
        </h2>
        {pending.length === 0 ? <EmptyState title="No hay pedidos pendientes">Los pedidos nuevos aparecen cuando se sincroniza con Fierro.</EmptyState> : <PendingTable rows={pending} />}
      </section>
    </>
  );
}
