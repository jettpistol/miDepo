import { asc, eq } from "drizzle-orm";
import { BotonAccion, Formulario } from "@/components/Escaneo";
import { Encabezado, fechaCorta } from "@/components/ui";
import { passkeys } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { Avatar } from "@/components/Avatar";
import { cambiarClave, cambiarPin, guardarApariencia, guardarFoto, quitarFoto, quitarLlave } from "./acciones";
import { Foto } from "./Foto";
import { Apariencia } from "./Apariencia";
import { AgregarLlave } from "./Llaves";

export const metadata = { title: "Mi cuenta" };

export default async function Cuenta() {
  const { db, usuario, empresa } = await requerir();
  const llaves = await db.select().from(passkeys).where(eq(passkeys.usuarioId, usuario.id)).orderBy(asc(passkeys.creado));

  return (
    <>
      <Encabezado titulo="Mi cuenta" bajada={`${usuario.nombre} · ${usuario.email}`} />
      <div className="space-y-4">
        <section className="tarjeta p-5">
          <h2 className="text-lg font-bold">Foto de perfil</h2>
          <p className="mb-4 text-sm text-suave">La ven tus compañeros en la lista de usuarios y al cambiar de cuenta. Sin foto, se muestran tus iniciales.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar persona={usuario} clase="size-20 text-2xl" />
            <div className="flex flex-wrap items-start gap-2">
              <Foto accion={guardarFoto} tiene={Boolean(usuario.fotoVersion)} />
              {usuario.fotoVersion && (
                <BotonAccion accion={quitarFoto} clase="boton-suave" mostrarOk={false}>
                  Quitar foto
                </BotonAccion>
              )}
            </div>
          </div>
        </section>

        <section className="tarjeta p-5">
          <h2 className="text-lg font-bold">Apariencia</h2>
          <p className="mb-4 text-sm text-suave">El color es tuyo: cambia todo miDepo solo para vos, en cualquier dispositivo donde entres.</p>
          <Apariencia accion={guardarApariencia} acento={usuario.acento} tema={usuario.tema} />
        </section>

        <section className="tarjeta p-5">
          <h2 className="text-lg font-bold">Huella, rostro o llave</h2>
          <p className="mb-4 text-sm text-suave">Registrá este teléfono o esta computadora y entrá sin escribir nada: con tu huella, tu rostro o el PIN del equipo.</p>
          {llaves.length > 0 && (
            <ul className="mb-4 divide-y divide-borde/70 rounded-xl border border-borde">
              {llaves.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span>
                    <span className="font-semibold">{l.nombre}</span> <span className="text-suave">· registrada el {fechaCorta(l.creado)}</span>
                  </span>
                  <BotonAccion accion={quitarLlave} ocultos={{ id: l.id }} clase="cursor-pointer font-semibold text-peligro" confirmar="¿Quitar esta llave? Ese dispositivo va a tener que entrar con contraseña o PIN." mostrarOk={false}>
                    Quitar
                  </BotonAccion>
                </li>
              ))}
            </ul>
          )}
          <AgregarLlave />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="tarjeta p-5">
            <h2 className="mb-3 text-lg font-bold">Contraseña</h2>
            <Formulario accion={cambiarClave} boton="Cambiar contraseña">
              {usuario.passwordHash && (
                <div>
                  <label htmlFor="actual" className="etiqueta">
                    Contraseña actual
                  </label>
                  <input id="actual" name="actual" type="password" autoComplete="current-password" className="campo" required />
                </div>
              )}
              <div>
                <label htmlFor="nueva" className="etiqueta">
                  Contraseña nueva
                </label>
                <input id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={8} className="campo" placeholder="8 caracteres o más" required />
              </div>
            </Formulario>
          </section>
          <section className="tarjeta p-5">
            <h2 className="text-lg font-bold">PIN del depósito</h2>
            <p className="mb-3 text-sm text-suave">
              {usuario.pinHmac ? "Ya tenés un PIN." : "Todavía no tenés PIN."} Para entrar con PIN se pide el código de empresa: <strong className="font-mono text-texto">{empresa.slug}</strong>
            </p>
            <Formulario accion={cambiarPin} boton="Guardar PIN">
              <div>
                <label htmlFor="pin" className="etiqueta">
                  PIN nuevo
                </label>
                <input id="pin" name="pin" type="password" inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="off" className="campo max-w-48 text-center font-mono text-xl tracking-[0.4em]" placeholder="••••••" required />
              </div>
            </Formulario>
          </section>
        </div>
      </div>
    </>
  );
}
