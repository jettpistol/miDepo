import { asc, eq } from "drizzle-orm";
import { Avatar } from "@/components/Avatar";
import { BotonAccion, Formulario } from "@/components/Escaneo";
import { Aviso, Encabezado, Insignia } from "@/components/ui";
import { usuarios } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { alternarActivo, cambiarRol, crear, fijarAcceso, quitarFotoDe } from "./acciones";

export const metadata = { title: "Usuarios" };

const ROLES = [
  { id: "operario", nombre: "Operario", ayuda: "Hace el trabajo del depósito." },
  { id: "supervisor", nombre: "Supervisor", ayuda: "Además arma conteos, ubicaciones y habla con Fierro." },
  { id: "admin", nombre: "Administrador", ayuda: "Además maneja los usuarios." },
] as const;

export default async function Usuarios() {
  const { db, empresa, usuario } = await requerir("admin");
  const lista = await db.select().from(usuarios).where(eq(usuarios.empresaId, empresa.id)).orderBy(asc(usuarios.nombre));

  return (
    <>
      <Encabezado titulo="Usuarios" bajada={`${lista.filter((u) => u.activo).length} personas pueden entrar a miDepo de ${empresa.nombre}.`} />
      <div className="mb-5">
        <Aviso>
          Para entrar con PIN desde el teléfono, cada persona escribe una sola vez el código de empresa: <strong className="font-mono">{empresa.slug}</strong>
        </Aviso>
      </div>

      <ul className="space-y-2">
        {lista.map((u) => (
          <li key={u.id} className={`tarjeta p-4 ${u.activo ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar persona={u} clase="size-10 text-sm" />
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {u.nombre} {u.id === usuario.id && <span className="font-normal text-suave">(vos)</span>}
                  </span>
                  <span className="block truncate text-sm text-suave">{u.email}</span>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Insignia tono="acento">{ROLES.find((r) => r.id === u.rol)?.nombre}</Insignia>
                {u.passwordHash && <Insignia>Contraseña</Insignia>}
                {u.pinHmac && <Insignia>PIN</Insignia>}
                {!u.activo && <Insignia tono="peligro">Dado de baja</Insignia>}
              </span>
            </div>
            {u.id !== usuario.id && (
              <details className="mt-3 border-t border-borde/70 pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-acento-texto">Cambiar rol, acceso o dar de baja</summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Formulario accion={cambiarRol} boton="Guardar rol" clase="space-y-2" reiniciar={false}>
                    <input type="hidden" name="id" value={u.id} />
                    <label className="etiqueta" htmlFor={`rol-${u.id}`}>
                      Rol
                    </label>
                    <select id={`rol-${u.id}`} name="rol" defaultValue={u.rol} className="campo">
                      {ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  </Formulario>
                  <Formulario accion={fijarAcceso} boton="Guardar acceso" clase="space-y-2">
                    <input type="hidden" name="id" value={u.id} />
                    <label className="etiqueta" htmlFor={`pin-${u.id}`}>
                      PIN nuevo y/o contraseña nueva
                    </label>
                    <input id={`pin-${u.id}`} name="pin" inputMode="numeric" maxLength={6} className="campo font-mono" placeholder="PIN de 6 números" autoComplete="off" />
                    <input name="clave" type="password" className="campo" placeholder="Contraseña (8 o más)" aria-label="Contraseña nueva" autoComplete="new-password" />
                  </Formulario>
                  <div className="flex flex-wrap items-start gap-2">
                    {u.fotoVersion && (
                      <BotonAccion accion={quitarFotoDe} ocultos={{ id: u.id }} clase="boton-suave" confirmar={`¿Quitar la foto de ${u.nombre}?`}>
                        Quitar foto
                      </BotonAccion>
                    )}
                    <BotonAccion accion={alternarActivo} ocultos={{ id: u.id }} clase={u.activo ? "boton-peligro" : "boton-suave"} confirmar={u.activo ? `¿Dar de baja a ${u.nombre}? No va a poder entrar más.` : undefined}>
                      {u.activo ? "Dar de baja" : "Volver a habilitar"}
                    </BotonAccion>
                  </div>
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>

      <section className="tarjeta mt-6 p-5">
        <h2 className="mb-3 text-lg font-bold">Sumar a alguien</h2>
        <Formulario accion={crear} boton="Crear usuario" clase="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nombre" className="etiqueta">
              Nombre y apellido
            </label>
            <input id="nombre" name="nombre" className="campo" required />
          </div>
          <div>
            <label htmlFor="email" className="etiqueta">
              Email
            </label>
            <input id="email" name="email" type="email" className="campo" required autoComplete="off" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rol" className="etiqueta">
              Rol
            </label>
            <select id="rol" name="rol" className="campo" defaultValue="operario">
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}: {r.ayuda}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pin" className="etiqueta">
              PIN <span className="font-normal text-suave">(para el teléfono)</span>
            </label>
            <input id="pin" name="pin" inputMode="numeric" maxLength={6} className="campo font-mono" placeholder="6 números" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="clave" className="etiqueta">
              Contraseña <span className="font-normal text-suave">(para la computadora)</span>
            </label>
            <input id="clave" name="clave" type="password" className="campo" placeholder="8 caracteres o más" autoComplete="new-password" />
          </div>
        </Formulario>
      </section>
    </>
  );
}
