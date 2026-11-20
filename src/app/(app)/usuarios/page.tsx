import { asc, eq } from "drizzle-orm";
import { Avatar } from "@/components/Avatar";
import { ActionButton, ActionForm } from "@/components/ScanForm";
import { Code, PageHeader, Badge } from "@/components/ui";
import { users } from "@/db/schema";
import { Select } from "@/components/Select";
import { requireSession } from "@/lib/session";
import { toggleActive, changeRole, create, setAccess, removePhotoOf } from "./actions";

export const metadata = { title: "Usuarios" };

const ROLES = [
  { id: "operator", name: "Operario", help: "Hace el trabajo del depósito." },
  { id: "supervisor", name: "Supervisor", help: "Además arma conteos, ubicaciones y habla con Fierro." },
  { id: "admin", name: "Administrador", help: "Además maneja los usuarios." },
] as const;

export default async function Users() {
  const { db, company, user } = await requireSession("admin");
  const list = await db.select().from(users).where(eq(users.companyId, company.id)).orderBy(asc(users.name));

  return (
    <>
      <PageHeader title="Usuarios" subtitle={
          <>
            {list.filter((u) => u.active).length} personas · código de empresa para entrar con PIN: <Code>{company.slug}</Code>
          </>
        }
      />

      <ul className="ruled-list framed">
        {list.map((u) => (
          <li key={u.id} className="px-2 py-3 lg:py-2 lg:px-3">
            <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${u.active ? "" : "text-muted"}`}>
              <span className="flex min-w-0 items-center gap-3">
                <Avatar person={u} className="size-9 text-sm" />
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {u.name} {u.id === user.id && <span className="font-normal text-muted">(tú)</span>}
                  </span>
                  <span className="block truncate text-sm text-muted">{u.email}</span>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge tone="accent">{ROLES.find((r) => r.id === u.role)?.name}</Badge>
                {u.passwordHash && <Badge>Contraseña</Badge>}
                {u.pinHmac && <Badge>PIN</Badge>}
                {!u.active && <Badge tone="danger">Dado de baja</Badge>}
              </span>
            </div>
            {u.id !== user.id && (
              <details className="mt-2 sm:pl-12">
                <summary className="link inline-block cursor-pointer text-sm">Cambiar rol, acceso o dar de baja</summary>
                <div className="mt-3 mb-2 grid max-w-3xl gap-x-6 gap-y-5 sm:grid-cols-2">
                  <ActionForm action={changeRole} button="Guardar rol" className="space-y-2" resetOnOk={false}>
                    <input type="hidden" name="id" value={u.id} />
                    <label className="field-label" htmlFor={`rol-${u.id}`}>
                      Rol
                    </label>
                    <Select id={`rol-${u.id}`} name="role" defaultValue={u.role} options={ROLES.map((r) => ({ value: r.id, label: r.name, detail: r.help }))} />
                  </ActionForm>
                  <ActionForm action={setAccess} button="Guardar acceso" className="space-y-2" anyOf={{ fields: ["pin", "password"], message: "Escribe un PIN nuevo, una contraseña nueva o las dos cosas." }}>
                    <input type="hidden" name="id" value={u.id} />
                    <label className="field-label" htmlFor={`pin-${u.id}`}>
                      PIN nuevo y/o contraseña nueva
                    </label>
                    <input id={`pin-${u.id}`} name="pin" inputMode="numeric" maxLength={6} pattern="\d{6}" title="6 números" className="field font-mono" placeholder="PIN de 6 números" autoComplete="off" />
                    <input name="password" type="password" minLength={8} className="field" placeholder="Contraseña (8 o más)" aria-label="Contraseña nueva" autoComplete="new-password" />
                  </ActionForm>
                  <div className="flex flex-wrap items-start gap-2">
                    {u.photoVersion && (
                      <ActionButton action={removePhotoOf} hiddenFields={{ id: u.id }} className="btn-soft" confirm={`¿Quitar la foto de ${u.name}?`}>
                        Quitar foto
                      </ActionButton>
                    )}
                    <ActionButton action={toggleActive} hiddenFields={{ id: u.id }} className={u.active ? "btn-danger" : "btn-soft"} confirm={u.active ? `¿Dar de baja a ${u.name}? No va a poder entrar más.` : undefined}>
                      {u.active ? "Dar de baja" : "Volver a habilitar"}
                    </ActionButton>
                  </div>
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>

      <section id="sumar" className="panel mt-10 lg:mt-8 max-w-3xl p-5 lg:p-4">
        <h2 className="section-title mb-3">Sumar a alguien</h2>
        <ActionForm action={create} button="Crear usuario" className="grid gap-3 sm:grid-cols-2" anyOf={{ fields: ["pin", "password"], message: "Dale un PIN, una contraseña o las dos cosas para que pueda entrar." }}>
          <div>
            <label htmlFor="name" className="field-label">
              Nombre y apellido
            </label>
            <input id="name" name="name" className="field" required />
          </div>
          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input id="email" name="email" type="email" className="field" required autoComplete="off" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="role" className="field-label">
              Rol
            </label>
            <Select id="role" name="role" defaultValue="operator" required options={ROLES.map((r) => ({ value: r.id, label: r.name, detail: r.help }))} />
          </div>
          <div>
            <label htmlFor="pin" className="field-label">
              PIN
            </label>
            <input id="pin" name="pin" inputMode="numeric" maxLength={6} pattern="\d{6}" title="6 números" className="field font-mono" placeholder="6 números" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="password" className="field-label">
              Contraseña
            </label>
            <input id="password" name="password" type="password" minLength={8} className="field" placeholder="8 caracteres o más" autoComplete="new-password" />
          </div>
        </ActionForm>
      </section>
    </>
  );
}
