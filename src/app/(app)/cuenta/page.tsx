import { asc, eq } from "drizzle-orm";
import { ActionButton, ActionForm } from "@/components/ScanForm";
import { Code, PageHeader, shortDate } from "@/components/ui";
import { passkeys } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { Avatar } from "@/components/Avatar";
import { changePassword, changePin, saveAppearance, savePhoto, removePhoto, removePasskey } from "./actions";
import { Photo } from "./Photo";
import { Appearance } from "./Appearance";
import { AddPasskey } from "./Passkeys";

export const metadata = { title: "Mi cuenta" };

export default async function Account() {
  const { db, user, company } = await requireSession();
  const keys = await db.select().from(passkeys).where(eq(passkeys.userId, user.id)).orderBy(asc(passkeys.createdAt));

  const section = "grid gap-x-10 gap-y-4 py-7 lg:grid-cols-[17rem_minmax(0,1fr)]";

  return (
    <>
      <PageHeader title="Mi cuenta" subtitle={`${user.name} · ${user.email}`} />
      <div className="max-w-4xl divide-y divide-line border-y border-line">
        <section className={section}>
          <h2 className="section-title">Foto de perfil</h2>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar person={user} className="size-20 text-2xl" />
            <div className="flex flex-wrap items-start gap-2">
              <Photo action={savePhoto} has={Boolean(user.photoVersion)} />
              {user.photoVersion && (
                <ActionButton action={removePhoto} className="btn-soft" showOk={false}>
                  Quitar foto
                </ActionButton>
              )}
            </div>
          </div>
        </section>

        <section className={section}>
          <h2 className="section-title">Apariencia</h2>
          <Appearance action={saveAppearance} accent={user.accent} theme={user.theme} />
        </section>

        <section className={section}>
          <h2 className="section-title">
            Huella, rostro o llave {keys.length > 0 && <small>{keys.length}</small>}
          </h2>
          <div className="max-w-xl">
            {keys.length > 0 && (
              <ul className="ruled-list mb-4">
                {keys.map((l) => (
                  <li key={l.id} className="row flex-wrap justify-between">
                    <span>
                      <span className="font-semibold">{l.name}</span> <span className="text-sm text-muted">· registrada el {shortDate(l.createdAt)}</span>
                    </span>
                    <ActionButton action={removePasskey} hiddenFields={{ id: l.id }} className="cursor-pointer rounded-control text-sm font-semibold text-danger underline decoration-danger/35 underline-offset-[3px] transition-colors duration-150 hover:decoration-danger disabled:opacity-55" confirm="¿Quitar esta llave? Ese dispositivo va a tener que entrar con contraseña o PIN." showOk={false}>
                      Quitar
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
            <AddPasskey />
          </div>
        </section>

        <section className={section}>
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

        <section className={section}>
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
                <input id="pin" name="pin" type="password" inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="off" className="field max-w-48 text-center font-mono text-xl tracking-[0.4em]" placeholder="••••••" required />
              </div>
            </ActionForm>
          </div>
        </section>
      </div>
    </>
  );
}
