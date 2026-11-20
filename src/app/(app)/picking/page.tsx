import { and, eq } from "drizzle-orm";
import { PageHeader, EmptyState, Notice } from "@/components/ui";
import { orders } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { assignees } from "@/components/Assignee";
import { BatchesTable, InProgressTable, loadOpenOrders, PendingTable, TakeAllButton } from "./Tables";

export const metadata = { title: "Picking" };

export default async function Picking({ searchParams }: { searchParams: Promise<{ soltado?: string }> }) {
  const released = Number((await searchParams).soltado);
  const session = await requireSession();
  const { db, company, user } = session;
  const [dropped] = Number.isInteger(released) && released > 0 ? await db.select({ number: orders.number }).from(orders).where(and(eq(orders.id, released), eq(orders.companyId, company.id), eq(orders.status, "pending"))) : [];
  const [{ inProgress, pending, batches }, a] = await Promise.all([loadOpenOrders(db, company.id), assignees(session)]);

  return (
    <>
      <PageHeader title="Picking" />
      {dropped && (
        <div className="mb-5">
          <Notice tone="ok">Pedido {dropped.number} soltado: volvió a Pendientes.</Notice>
        </div>
      )}

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
        {pending.length === 0 ? <EmptyState title="No hay pedidos pendientes">Los pedidos nuevos aparecen cuando se sincroniza con Fierro.</EmptyState> : <PendingTable rows={pending} a={a} />}
      </section>
    </>
  );
}
