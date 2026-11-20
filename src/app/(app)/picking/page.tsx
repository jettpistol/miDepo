import { and, eq } from "drizzle-orm";
import { PageHeader, EmptyState, Notice } from "@/components/ui";
import { orders } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { InProgressTable, loadOpenOrders, PendingTable } from "./Tables";

export const metadata = { title: "Picking" };

export default async function Picking({ searchParams }: { searchParams: Promise<{ soltado?: string }> }) {
  const released = Number((await searchParams).soltado);
  const { db, company, user } = await requireSession();
  const [dropped] = Number.isInteger(released) && released > 0 ? await db.select({ number: orders.number }).from(orders).where(and(eq(orders.id, released), eq(orders.companyId, company.id), eq(orders.status, "pending"))) : [];
  const { inProgress, pending } = await loadOpenOrders(db, company.id);

  return (
    <>
      <PageHeader title="Picking" />
      {dropped && (
        <div className="mb-5">
          <Notice tone="ok">Pedido {dropped.number} soltado: volvió a Pendientes.</Notice>
        </div>
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
        <h2 className="section-title">
          Pendientes <small>{pending.length}</small>
        </h2>
        {pending.length === 0 ? <EmptyState title="No hay pedidos pendientes">Los pedidos nuevos aparecen cuando se sincroniza con Fierro.</EmptyState> : <PendingTable rows={pending} />}
      </section>
    </>
  );
}
