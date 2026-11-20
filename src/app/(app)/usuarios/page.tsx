import { asc, eq } from "drizzle-orm";
import { Avatar } from "@/components/Avatar";
import { NewButton } from "@/components/NewButton";
import { RowMenu } from "@/components/RowMenu";
import { ActionButton, ActionForm } from "@/components/ScanForm";
import { Code, PageHeader, Badge, EmptyRow, plural } from "@/components/ui";
import { users } from "@/db/schema";
import { Select } from "@/components/Select";
import { requireSession } from "@/lib/session";
import { toggleActive, changeRole, create, setAccess, removePhotoOf } from "./actions";

export const metadata = { title: "Usuarios" };

const ROLES = [
  { id: "operator", name: "Operario", help: "Trabajo del depósito." },
  { id: "supervisor", name: "Supervisor", help: "Operario, más conteos, ubicaciones y Fierro." },
  { id: "admin", name: "Administrador", help: "Supervisor, más usuarios." },
] as const;
const roleOptions = ROLES.map((r) => ({ value: r.id, label: r.name, detail: r.help }));

export default async function Users() {
  const { db, company, user } = await requireSession("admin");
  const list = await db.select().from(users).where(eq(users.companyId, company.id)).orderBy(asc(users.name));
  // Given with every PIN: the PIN only works together with the company code.
  const pinNote = (
    <p className="text-sm text-muted lg:text-xs">
      Con PIN se inicia sesión con el código de empresa <Code>{company.slug}</Code>.
    </p>
  );

  return (
    <>
      <PageHeader title="Usuarios" subtitle={plural(list.filter((u) => u.active).length, "persona activa", "personas activas")}>
        <NewButton label="Nuevo" title="Nuevo usuario">
          <ActionForm action={create} button="Crear usuario" className="space-y-3" anyOf={{ fields: ["pin", "password"], message: "Asigna un PIN, una contraseña o ambos para que pueda iniciar sesión." }}>
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
            <div>
              <label htmlFor="role" className="field-label">
                Rol
              </label>
              <Select id="role" name="role" defaultValue="operator" required options={roleOptions} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pin" className="field-label">
                  PIN
                </label>
                <input id="pin" name="pin" inputMode="numeric" maxLength={6} pattern="\d{6}" title="6 dígitos" className="field font-mono" placeholder="6 dígitos" autoComplete="off" />
              </div>
              <div>
                <label htmlFor="password" className="field-label">
                  Contraseña
                </label>
                <input id="password" name="password" type="password" minLength={8} className="field" placeholder="8 o más" autoComplete="new-password" />
              </div>
            </div>
            {pinNote}
          </ActionForm>
        </NewButton>
      </PageHeader>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Persona</th>
              <th className="hidden md:table-cell">Email</th>
              <th>Rol</th>
              <th className="hidden sm:table-cell">Acceso</th>
              <th className="w-0">
                <span className="sr-only">Opciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && <EmptyRow columns={5} title="Sin usuarios" />}
            {list.map((u) => (
              <tr key={u.id} className={u.active ? "" : "text-muted"}>
                <td className="w-full max-w-0 py-1.5! md:w-auto md:max-w-none">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar person={u} className={`size-7 text-[11px] ${u.active ? "" : "opacity-50"}`} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {u.name} {u.id === user.id && <span className="font-normal text-muted">(tú)</span>} {!u.active && <Badge tone="danger">Desactivado</Badge>}
                      </span>
                      <span className="block truncate text-xs text-muted md:hidden">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className="hidden truncate text-muted md:table-cell">{u.email}</td>
                <td className="whitespace-nowrap">{ROLES.find((r) => r.id === u.role)?.name}</td>
                <td className="hidden whitespace-nowrap text-muted sm:table-cell">{[u.passwordHash && "Contraseña", u.pinHmac && "PIN"].filter(Boolean).join(" · ") || "—"}</td>
                <td className="py-1! text-right">
                  {u.id !== user.id && (
                    <RowMenu
                      label={`Opciones de ${u.name}`}
                      dialogs={[
                        {
                          label: "Cambiar rol",
                          title: `Rol de ${u.name}`,
                          content: (
                            <ActionForm action={changeRole} button="Guardar rol" className="space-y-3" resetOnOk={false}>
                              <input type="hidden" name="id" value={u.id} />
                              <label className="field-label" htmlFor={`rol-${u.id}`}>
                                Rol
                              </label>
                              <Select id={`rol-${u.id}`} name="role" defaultValue={u.role} options={roleOptions} />
                            </ActionForm>
                          ),
                        },
                        {
                          label: "Cambiar PIN o contraseña",
                          title: `Acceso de ${u.name}`,
                          content: (
                            <ActionForm action={setAccess} button="Guardar acceso" className="space-y-3" anyOf={{ fields: ["pin", "password"], message: "Escribe un PIN nuevo, una contraseña nueva o ambos." }}>
                              <input type="hidden" name="id" value={u.id} />
                              <div>
                                <label className="field-label" htmlFor={`pin-${u.id}`}>
                                  PIN nuevo
                                </label>
                                <input id={`pin-${u.id}`} name="pin" inputMode="numeric" maxLength={6} pattern="\d{6}" title="6 dígitos" className="field font-mono" placeholder="6 dígitos" autoComplete="off" />
                              </div>
                              <div>
                                <label className="field-label" htmlFor={`password-${u.id}`}>
                                  Contraseña nueva
                                </label>
                                <input id={`password-${u.id}`} name="password" type="password" minLength={8} className="field" placeholder="8 caracteres o más" autoComplete="new-password" />
                              </div>
                              {pinNote}
                            </ActionForm>
                          ),
                        },
                      ]}
                    >
                      {u.photoVersion && (
                        <ActionButton action={removePhotoOf} hiddenFields={{ id: u.id }} className="menu-item w-full" confirm={`¿Quitar la foto de ${u.name}?`}>
                          Quitar foto
                        </ActionButton>
                      )}
                      <ActionButton action={toggleActive} hiddenFields={{ id: u.id }} className={`menu-item w-full ${u.active ? "danger" : ""}`} confirm={u.active ? `¿Desactivar a ${u.name}? Ya no podrá iniciar sesión.` : undefined}>
                        {u.active ? "Desactivar" : "Reactivar"}
                      </ActionButton>
                    </RowMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
