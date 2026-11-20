import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/ScanForm";
import { removeSupplier } from "../../recepcion/actions";
import { suppliers, users } from "@/db/schema";
import { can, requireSession } from "@/lib/session";
import { ReceivingsTable } from "../../recepcion/ReceivingsTable";
import { receivingRows } from "@/lib/lists";

export default async function SupplierDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const id = Number((await params).id);
  const { db, company, user } = await requireSession();
  const [s] = Number.isInteger(id)
    ? await db.select({ id: suppliers.id, name: suppliers.name, createdAt: suppliers.createdAt, createdBy: users.name, createdById: suppliers.createdBy }).from(suppliers).leftJoin(users, eq(users.id, suppliers.createdBy)).where(and(eq(suppliers.id, id), eq(suppliers.companyId, company.id)))
    : [];
  if (!s) notFound();
  const page = requestedPage((await searchParams).pagina);
  const list = await receivingRows(db, company.id, eq(suppliers.id, s.id), paging(page));
  const origin = s.createdBy ? `Creado en miDepo por ${s.createdBy}, ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(s.createdAt)}` : "De Fierro";

  return (
    <>
      <PageHeader title={s.name} subtitle={origin} back={{ href: "/proveedores", text: "Proveedores" }}>
        {s.createdById != null && can(user.role, "supervisor") && (
          <ActionButton action={removeSupplier} hiddenFields={{ id: s.id }} className="btn-soft" showOk={false} reason={list.total > 0 ? "Tiene recepciones: ya no se puede borrar." : undefined} confirm={`¿Borrar el proveedor ${s.name}? No se puede deshacer.`}>
            Borrar proveedor
          </ActionButton>
        )}
      </PageHeader>
      <h2 className="section-title">
        Recepciones <small>{list.total}</small>
      </h2>
      <ReceivingsTable rows={list.rows} showSupplier={false} empty={{ title: "Todavía no hay recepciones de este proveedor" }} />
      <Pager base={`/proveedores/${s.id}`} params={{}} page={page} total={list.total} />
    </>
  );
}

