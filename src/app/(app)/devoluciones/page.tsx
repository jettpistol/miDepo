import { asc, eq } from "drizzle-orm";
import { LiveSearch } from "@/components/LiveSearch";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { ReturnsTable } from "./ReturnsTable";
import { returnRows } from "@/lib/lists";
import { NewButton } from "@/components/NewButton";
import { ActionForm } from "@/components/ScanForm";
import { Select } from "@/components/Select";
import { PageHeader } from "@/components/ui";
import { customers, returns } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { create } from "./actions";

export const metadata = { title: "Devoluciones" };

export default async function Returns({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { db, company } = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = requestedPage(sp.pagina);
  const [list, { rows: inProgress }, closed] = await Promise.all([
    db.select({ id: customers.id, name: customers.name, city: customers.city }).from(customers).where(eq(customers.companyId, company.id)).orderBy(asc(customers.name)),
    returnRows(db, company.id, eq(returns.status, "in_progress"), { limit: 500, offset: 0 }),
    returnRows(db, company.id, eq(returns.status, "closed"), paging(page), q),
  ]);

  return (
    <>
      <PageHeader title="Devoluciones">
        <NewButton title="Nueva devolución">
          <ActionForm action={create} button="Empezar a revisar" className="space-y-3 [&>button]:w-full">
            <div>
              <label htmlFor="customer" className="field-label">
                Cliente que devuelve
              </label>
              <Select
                name="customerId"
                id="customer"
                options={list.map((c) => ({ value: String(c.id), label: c.name, detail: c.city ?? undefined }))}
                required
                requiredMessage="Elige el cliente de la lista."
                placeholder="Elige el cliente"
                searchPlaceholder="Buscar cliente o localidad…"
                empty="Ningún cliente coincide. Los clientes llegan de Fierro al sincronizar."
              />
            </div>
          </ActionForm>
        </NewButton>
      </PageHeader>

      <section className="mb-8 lg:mb-6">
        <h2 className="section-title">
          En curso <small>{inProgress.length}</small>
        </h2>
        <ReturnsTable rows={inProgress} empty={{ title: "Sin devoluciones en curso" }} />
      </section>

      <section id="cerradas">
        <h2 className="section-title">
          Cerradas <small>{closed.total}</small>
        </h2>
        {(closed.total > 0 || q) && <LiveSearch placeholder="Número o cliente" className="mb-3 max-w-md" />}
        <ReturnsTable rows={closed.rows} empty={q ? { title: `Ninguna devolución cerrada coincide con "${q}"` } : { title: "Sin devoluciones cerradas" }} />
        <Pager base="/devoluciones" params={{ q }} page={page} total={closed.total} />
      </section>
    </>
  );
}
