import { PageHeader } from "@/components/ui";
import { FilterTabs, Pager, paging, requestedPage } from "@/components/ListTools";
import { LiveSearch } from "@/components/LiveSearch";
import type { OrderStatus } from "@/db/schema";
import { listOrders, ORDER_STATUSES } from "@/lib/lists";
import { requireSession } from "@/lib/session";
import { ORDER_STATE, OrdersTable } from "./OrdersTable";

export const metadata = { title: "Pedidos" };

const isStatus = (v: string | undefined): v is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(v ?? "");

export default async function Orders({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; pagina?: string }> }) {
  const { db, company } = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = isStatus(sp.estado) ? sp.estado : undefined;
  const page = requestedPage(sp.pagina);
  const r = await listOrders(db, company.id, { q, status }, paging(page));
  const params = { q, estado: status };

  return (
    <>
      <PageHeader title="Pedidos" />
      <LiveSearch placeholder="Número de pedido o cliente" />
      <FilterTabs
        base="/pedidos"
        params={params}
        name="estado"
        value={status ?? ""}
        tabs={[{ value: "", label: "Todos", count: r.all }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATE[s].label, count: r.counts[s] }))]}
      />
      <OrdersTable
        rows={r.rows}
        empty={q ? { title: `Ningún pedido coincide con "${q}"` } : status ? { title: `No hay pedidos en "${ORDER_STATE[status].label}"` } : { title: "Todavía no hay pedidos", text: "Los pedidos llegan de Fierro al sincronizar." }}
      />
      <Pager base="/pedidos" params={params} page={page} total={r.total} />
    </>
  );
}
