import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { NewButton } from "@/components/NewButton";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { LiveSearch } from "@/components/LiveSearch";
import { EmptyRow, PageHeader, shortDate } from "@/components/ui";
import { suppliers } from "@/db/schema";
import { listSuppliers } from "@/lib/lists";
import { can, requireSession } from "@/lib/session";
import { NewSupplier } from "./NewSupplier";

export const metadata = { title: "Proveedores" };

const day = (d: Date) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(d);

export default async function Suppliers({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { db, company, user } = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = requestedPage(sp.pagina);
  const supervisor = can(user.role, "supervisor");
  const [{ total, rows }, options] = await Promise.all([
    listSuppliers(db, company.id, q, paging(page)),
    supervisor ? db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.companyId, company.id)).orderBy(asc(suppliers.name)) : [],
  ]);

  return (
    <>
      <PageHeader title="Proveedores">
        {supervisor && (
          <NewButton label="Nuevo" title="Nuevo proveedor">
            <NewSupplier options={options.map((s) => ({ value: String(s.id), label: s.name }))} />
          </NewButton>
        )}
      </PageHeader>
      <LiveSearch placeholder="Nombre del proveedor" />
      <h2 className="section-title">
        {q ? "Resultados" : "Todos los proveedores"} <small>{total}</small>
      </h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th className="hidden sm:table-cell">Origen</th>
              <th className="text-right">Recepciones</th>
              <th className="hidden md:table-cell">Última recepción</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow columns={4} title={q ? `Ningún proveedor coincide con "${q}"` : "Sin proveedores"}>
                {q ? undefined : "Llegan de Fierro al sincronizar."}
              </EmptyRow>
            )}
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/proveedores/${s.id}`} className="link">
                    {s.name}
                  </Link>
                  <span className="block text-muted sm:hidden">{s.createdBy ? `miDepo · ${s.createdBy}` : "Fierro"}</span>
                </td>
                <td className="hidden text-muted sm:table-cell">{s.createdBy ? `miDepo · ${s.createdBy} · ${day(s.createdAt)}` : "Fierro"}</td>
                <td className="text-right font-semibold tabular-nums">{s.receivings}</td>
                <td className="hidden whitespace-nowrap text-muted md:table-cell">{s.last ? shortDate(new Date(s.last)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/proveedores" params={{ q }} page={page} total={total} />
    </>
  );
}
