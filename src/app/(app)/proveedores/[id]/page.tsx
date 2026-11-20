import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { PageHeader } from "@/components/ui";
import { suppliers, users } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { ReceivingsTable } from "../../recepcion/ReceivingsTable";
import { receivingRows } from "@/lib/lists";

export default async function SupplierDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const id = Number((await params).id);
  const { db, company } = await requireSession();
  const [s] = Number.isInteger(id)
    ? await db.select({ id: suppliers.id, name: suppliers.name, createdAt: suppliers.createdAt, createdBy: users.name }).from(suppliers).leftJoin(users, eq(users.id, suppliers.createdBy)).where(and(eq(suppliers.id, id), eq(suppliers.companyId, company.id)))
    : [];
  if (!s) notFound();
  const page = requestedPage((await searchParams).pagina);
  const list = await receivingRows(db, company.id, eq(suppliers.id, s.id), paging(page));
  const origin = `Origen: ${s.createdBy ? `miDepo · ${s.createdBy} · ${new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(s.createdAt)}` : "Fierro"}`;

  return (
    <>
      <PageHeader title={s.name} subtitle={origin} back={{ href: "/proveedores", text: "Proveedores" }} />
      <h2 className="section-title">
        Recepciones <small>{list.total}</small>
      </h2>
      <ReceivingsTable rows={list.rows} showSupplier={false} empty={{ title: "Sin recepciones" }} />
      <Pager base={`/proveedores/${s.id}`} params={{}} page={page} total={list.total} />
    </>
  );
}

