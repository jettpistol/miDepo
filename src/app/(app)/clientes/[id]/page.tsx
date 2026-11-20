import { notFound } from "next/navigation";
import { commentCounts } from "@/lib/flows/comments";
import { and, eq } from "drizzle-orm";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { Badge, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/ScanForm";
import { can } from "@/lib/session";
import { customerControl } from "../actions";
import { customers, returns } from "@/db/schema";
import { listOrders } from "@/lib/lists";
import { requireSession } from "@/lib/session";
import { OrdersTable } from "../../pedidos/OrdersTable";
import { ReturnsTable } from "../../devoluciones/ReturnsTable";
import { returnRows } from "@/lib/lists";

export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const id = Number((await params).id);
  const { db, company, user } = await requireSession();
  const [c] = Number.isInteger(id) ? await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.companyId, company.id))) : [];
  if (!c) notFound();
  const page = requestedPage((await searchParams).pagina);
  const [ords, rets] = await Promise.all([listOrders(db, company.id, { customerId: c.id }, paging(page)), returnRows(db, company.id, eq(returns.customerId, c.id), { limit: 500, offset: 0 })]);
  const address = [c.address, c.city, c.province].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader title={c.name} subtitle={address || undefined} back={{ href: "/clientes", text: "Clientes" }}>
        {c.alwaysControl && <Badge tone="accent">Control obligatorio</Badge>}
        {can(user.role, "admin") && (
          <ActionButton
            action={customerControl}
            hiddenFields={{ id: c.id, always: c.alwaysControl ? "no" : "yes" }}
            className="btn-soft"
          >
            {c.alwaysControl ? "Quitar control obligatorio" : "Marcar control obligatorio"}
          </ActionButton>
        )}
      </PageHeader>
      <section className="mb-8 lg:mb-6">
        <h2 className="section-title">
          Pedidos <small>{ords.all}</small>
        </h2>
        <OrdersTable rows={ords.rows} showCustomer={false} empty={{ title: "Sin pedidos" }} comments={await commentCounts(db, company.id, "order", ords.rows.map((x) => x.o.id))} />
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
