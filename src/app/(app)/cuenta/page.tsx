import { and, asc, eq } from "drizzle-orm";
import { ActionButton, ActionForm } from "@/components/ScanForm";
import { Code, PageHeader, shortDate } from "@/components/ui";
import { customers, passkeys } from "@/db/schema";
import Link from "next/link";
import { can, requireSession } from "@/lib/session";
import { Select } from "@/components/Select";
import { Avatar } from "@/components/Avatar";
import { changePassword, changePin, saveAppearance, saveBatchSorting, savePhoto, removePhoto, removePasskey } from "./actions";
import { Photo } from "./Photo";
import { Appearance } from "./Appearance";
import { AddPasskey } from "./Passkeys";
import { ControlSettings } from "./ControlSettings";
import { controlMode } from "@/lib/flows/settings";

export const metadata = { title: "Ajustes" };

export default async function Account() {
  const { db, user, company } = await requireSession();
  const keys = await db.select().from(passkeys).where(eq(passkeys.userId, user.id)).orderBy(asc(passkeys.createdAt));
  const admin = can(user.role, "admin");
  const alwaysControl = admin ? await db.select({ id: customers.id, name: customers.name }).from(customers).where(and(eq(customers.companyId, company.id), eq(customers.alwaysControl, true))).orderBy(asc(customers.name)) : [];

  const section = "grid gap-x-10 lg:gap-x-8 gap-y-4 py-7 lg:grid-cols-[17rem_minmax(0,1fr)]";

  return (
    <>
      <PageHeader title="Ajustes" subtitle={`${user.name} · ${user.email}`} />
      <div className="max-w-4xl divide-y divide-line border-y border-line">
        <section id="foto" className={section}>
          <h2 className="section-title">Foto de perfil</h2>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar person={user} className="size-20 lg:size-14 text-2xl" />
            <div className="flex flex-wrap items-start gap-2">
              <Photo action={savePhoto} has={Boolean(user.photoVersion)} />
              {user.photoVersion && (
                <ActionButton action={removePhoto} className="btn-soft" showOk={false} confirm="¿Quitar tu foto? No se puede deshacer; puedes subir otra cuando quieras.">
                  Quitar foto
                </ActionButton>
              )}
            </div>
          </div>
        </section>

        <section id="apariencia" className={section}>
          <h2 className="section-title">Apariencia</h2>
          <Appearance action={saveAppearance} accent={user.accent} theme={user.theme} font={user.font} />
        </section>

        <section id="llaves" className={section}>
          <h2 className="section-title">
            Huella, rostro o llave {keys.length > 0 && <small>{keys.length}</small>}
          </h2>
          <div className="max-w-xl">
            {keys.length > 0 && (
              <ul className="ruled-list framed mb-4">
                {keys.map((l) => (
                  <li key={l.id} className="row flex-wrap justify-between">
                    <span>
                      <span className="font-semibold">{l.name}</span> <span className="text-sm text-muted">· registrada el {shortDate(l.createdAt)}</span>
                    </span>
                    <ActionButton action={removePasskey} hiddenFields={{ id: l.id }} className="cursor-pointer rounded-control text-sm font-semibold text-danger underline decoration-danger/35 underline-offset-[3px] transition-colors duration-150 hover:decoration-danger disabled:opacity-55" confirm="¿Quitar esta llave? No se puede deshacer: para volver a usarla hay que registrarla de nuevo. Ese dispositivo tendrá que iniciar sesión con contraseña o PIN." showOk={false}>
                      Quitar
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
            <AddPasskey />
          </div>
        </section>

        <section id="contrasena" className={section}>
          <h2 className="section-title">Contraseña</h2>
          <div className="max-w-sm">
            <ActionForm action={changePassword} button="Cambiar contraseña">
              {user.passwordHash && (
                <div>
                  <label htmlFor="current" className="field-label">
                    Contraseña actual
                  </label>
                  <input id="current" name="current" type="password" autoComplete="current-password" className="field" required />
                </div>
              )}
              <div>
                <label htmlFor="newPassword" className="field-label">
                  Contraseña nueva
                </label>
                <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} className="field" placeholder="8 caracteres o más" required />
              </div>
            </ActionForm>
          </div>
        </section>

        {admin && (
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
        )}

        <section id="pin" className={section}>
          <div>
            <h2 className="section-title">PIN del depósito</h2>
            <p className="text-sm text-muted">
              Código de empresa: <Code>{company.slug}</Code>
            </p>
          </div>
          <div className="max-w-sm">
            <ActionForm action={changePin} button="Guardar PIN">
              <div>
                <label htmlFor="pin" className="field-label">
                  {user.pinHmac ? "PIN nuevo" : "PIN"}
                </label>
                <input id="pin" name="pin" type="password" inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="off" className="field max-w-48 text-center font-mono text-xl lg:text-base tracking-[0.4em]" placeholder="••••••" required />
              </div>
            </ActionForm>
          </div>
        </section>

        {can(user.role, "supervisor") && (
          <section id="lotes" className={section}>
            <h2 className="section-title">Picking por lotes</h2>
            <div className="max-w-sm">
              <ActionForm action={saveBatchSorting} button="Guardar" resetOnOk={false}>
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
        )}
      </div>
    </>
  );
}
