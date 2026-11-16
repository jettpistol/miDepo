import { asc, eq } from "drizzle-orm";
import { BotonAccion, Formulario } from "@/components/Escaneo";
import { Codigo, Encabezado, fechaCorta } from "@/components/ui";
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

  const seccion = "grid gap-x-10 gap-y-4 py-7 lg:grid-cols-[17rem_minmax(0,1fr)]";
  const bajada = "max-w-[60ch] text-sm text-suave";

  return (
    <>
      <Encabezado titulo="Mi cuenta" bajada={`${usuario.nombre} · ${usuario.email}`} />
      <div className="max-w-4xl divide-y divide-borde border-y border-borde">
        <section className={seccion}>
          <div>
            <h2 className="titulo-seccion">Foto de perfil</h2>
            <p className={bajada}>La ven tus compañeros en la lista de usuarios y al cambiar de cuenta. Sin foto, se muestran tus iniciales.</p>
          </div>
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

        <section className={seccion}>
          <div>
            <h2 className="titulo-seccion">Apariencia</h2>
            <p className={bajada}>El color es tuyo: cambia todo miDepo solo para vos, en cualquier dispositivo donde entres.</p>
          </div>
          <Apariencia accion={guardarApariencia} acento={usuario.acento} tema={usuario.tema} />
        </section>

        <section className={seccion}>
          <div>
            <h2 className="titulo-seccion">
              Huella, rostro o llave {llaves.length > 0 && <small>{llaves.length}</small>}
            </h2>
            <p className={bajada}>Registrá este teléfono o esta computadora y entrá sin escribir nada: con tu huella, tu rostro o el PIN del equipo.</p>
          </div>
          <div className="max-w-xl">
            {llaves.length > 0 && (
              <ul className="lista mb-4">
                {llaves.map((l) => (
                  <li key={l.id} className="fila flex-wrap justify-between">
                    <span>
                      <span className="font-semibold">{l.nombre}</span> <span className="text-sm text-suave">· registrada el {fechaCorta(l.creado)}</span>
                    </span>
                    <BotonAccion accion={quitarLlave} ocultos={{ id: l.id }} clase="cursor-pointer rounded-control text-sm font-semibold text-peligro underline decoration-peligro/35 underline-offset-[3px] transition-colors duration-150 hover:decoration-peligro disabled:opacity-55" confirmar="¿Quitar esta llave? Ese dispositivo va a tener que entrar con contraseña o PIN." mostrarOk={false}>
                      Quitar
                    </BotonAccion>
                  </li>
                ))}
              </ul>
            )}
            <AgregarLlave />
          </div>
        </section>

        <section className={seccion}>
          <h2 className="titulo-seccion">Contraseña</h2>
          <div className="max-w-sm">
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
          </div>
        </section>

        <section className={seccion}>
          <div>
            <h2 className="titulo-seccion">PIN del depósito</h2>
            <p className={bajada}>
              {usuario.pinHmac ? "Ya tenés un PIN." : "Todavía no tenés PIN."} Para entrar con PIN se pide el código de empresa: <Codigo>{empresa.slug}</Codigo>
            </p>
          </div>
          <div className="max-w-sm">
            <Formulario accion={cambiarPin} boton="Guardar PIN">
              <div>
                <label htmlFor="pin" className="etiqueta">
                  PIN nuevo
                </label>
                <input id="pin" name="pin" type="password" inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="off" className="campo max-w-48 text-center font-mono text-xl tracking-[0.4em]" placeholder="••••••" required />
              </div>
            </Formulario>
          </div>
        </section>
      </div>
    </>
  );
}
