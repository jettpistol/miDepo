import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { PageHeader } from "@/components/ui";
import { customers, returns } from "@/db/schema";
import { listOrders } from "@/lib/lists";
import { requireSession } from "@/lib/session";
import { OrdersTable } from "../../pedidos/OrdersTable";
import { ReturnsTable } from "../../devoluciones/ReturnsTable";
import { returnRows } from "@/lib/lists";

export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const id = Number((await params).id);
  const { db, company } = await requireSession();
  const [c] = Number.isInteger(id) ? await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.companyId, company.id))) : [];
  if (!c) notFound();
  const page = requestedPage((await searchParams).pagina);
  const [ords, rets] = await Promise.all([listOrders(db, company.id, { customerId: c.id }, paging(page)), returnRows(db, company.id, eq(returns.customerId, c.id), { limit: 500, offset: 0 })]);
  const address = [c.address, c.city, c.province].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader title={c.name} subtitle={address || undefined} back={{ href: "/clientes", text: "Clientes" }} />
      <section className="mb-8 lg:mb-6">
        <h2 className="section-title">
          Pedidos <small>{ords.all}</small>
        </h2>
        <OrdersTable rows={ords.rows} showCustomer={false} empty={{ title: "Sin pedidos" }} />
        <Pager base={`/clientes/${c.id}`} params={{}} page={page} total={ords.total} />
      </section>
      <section>
        <h2 className="section-title">
          Devoluciones <small>{rets.total}</small>
        </h2>
        <ReturnsTable rows={rets.rows} showCustomer={false} empty={{ title: "Sin devoluciones" }} />
      </section>
    </>
  );
}
