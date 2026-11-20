import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ActionForm } from "@/components/ScanForm";
import { Select } from "@/components/Select";
import { PageHeader } from "@/components/ui";
import { customers } from "@/db/schema";
import { controlMode, MAX_NAME } from "@/lib/flows/settings";
import { can, requireSession } from "@/lib/session";
import { changeCode, rename, saveSorting } from "./actions";
import { ControlSettings } from "./ControlSettings";

export const metadata = { title: "Organización" };

/** Settings for the whole company. Each person's own settings are in Ajustes (/cuenta). */
export default async function Organization() {
  const { db, user, company } = await requireSession("supervisor");
  const admin = can(user.role, "admin");
  const alwaysControl = admin ? await db.select({ id: customers.id, name: customers.name }).from(customers).where(and(eq(customers.companyId, company.id), eq(customers.alwaysControl, true))).orderBy(asc(customers.name)) : [];

  const section = "grid gap-x-10 lg:gap-x-8 gap-y-4 py-7 lg:grid-cols-[17rem_minmax(0,1fr)]";

  return (
    <>
      <PageHeader title="Organización" subtitle={company.name} />
      <div className="max-w-4xl divide-y divide-line border-y border-line">
        {admin && (
          <>
            <section id="nombre" className={section}>
              <h2 className="section-title">Nombre</h2>
              <div className="max-w-sm">
                <ActionForm action={rename} button="Guardar nombre" resetOnOk={false}>
                  <div>
                    <label htmlFor="name" className="sr-only">
                      Nombre
                    </label>
                    <input id="name" name="name" defaultValue={company.name} maxLength={MAX_NAME} className="field" required autoComplete="organization" />
                  </div>
                </ActionForm>
              </div>
            </section>

            <section id="codigo" className={section}>
              <div>
                <h2 className="section-title">Código de empresa</h2>
                <p className="text-sm text-muted">Para iniciar sesión con PIN. Cambiarlo no afecta los PIN ni las sesiones abiertas.</p>
              </div>
              <div className="max-w-sm">
                <ActionForm action={changeCode} button="Cambiar código" resetOnOk={false}>
                  <div>
                    <label htmlFor="slug" className="sr-only">
                      Código de empresa
                    </label>
                    <input id="slug" name="slug" defaultValue={company.slug} minLength={2} maxLength={20} pattern="[a-z0-9\-]{2,20}" title="Minúsculas, números y guiones, sin espacios" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" className="field max-w-56 font-mono" required />
                  </div>
                </ActionForm>
              </div>
            </section>

            <section id="control" className={section}>
              <h2 className="section-title">Control de pedidos</h2>
              <div>
                <ControlSettings mode={controlMode(company.controlMinUnits)} minUnits={company.controlMinUnits} samePerson={company.samePersonChecks} />
                {alwaysControl.length > 0 && (
                  <p className="mt-4 max-w-sm text-sm">
                    <span className="text-muted">Control obligatorio: </span>
                    {alwaysControl.map((cu, i) => (
                      <span key={cu.id}>
                        {i > 0 && ", "}
                        <Link href={`/clientes/${cu.id}`} className="link">
                          {cu.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        <section id="lotes" className={section}>
          <h2 className="section-title">Picking por lotes</h2>
          <div className="max-w-sm">
            <ActionForm action={saveSorting} button="Guardar" resetOnOk={false}>
              <div>
                <label htmlFor="sorting" className="field-label">
                  Separar por pedido
                </label>
                <Select
                  id="sorting"
                  name="sorting"
                  defaultValue={company.batchSorting}
                  options={[
                    { value: "packing", label: "En empaque", detail: "Todo el lote va a PREPARACIÓN; en empaque se separa por pedido." },
                    { value: "trays", label: "Por bandeja, al tomar", detail: "Cada pedido tiene su bandeja; cada escaneo dice cuántos van en cuál." },
                  ]}
                />
              </div>
            </ActionForm>
          </div>
        </section>
      </div>
    </>
  );
}
