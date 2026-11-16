import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ROL } from "@/components/Cuentas";
import { cuentasAbiertas, MAXIMO_CUENTAS, sesionActual } from "@/lib/sesion";
import { cambiarCuenta } from "./acciones";
import { Marca } from "@/components/Marca";
import { Tejuelo } from "@/components/ui";
import { Ingreso } from "./Ingreso";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Pagina({ searchParams }: { searchParams: Promise<{ agregar?: string }> }) {
  const agregando = Boolean((await searchParams).agregar);
  const cuentas = await cuentasAbiertas();
  // Con una cuenta en uso solo se llega acá para sumar otra.
  if ((await sesionActual()) && !agregando) redirect("/");
  const llena = cuentas.length >= MAXIMO_CUENTAS;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col justify-between bg-acento px-6 py-8 text-sobre-acento lg:px-14 lg:py-12">
        <Marca grande />
        <div className="my-8 max-w-md lg:my-0">
          <Tejuelo codigo="A-01-1" tam="md" sobreAcento className="mb-4 lg:hidden" />
          <Tejuelo codigo="A-01-1" tam="xl" sobreAcento className="mb-7 max-lg:hidden" />
          <h1 className="text-3xl leading-[1.1] font-bold tracking-[-0.025em] lg:text-[2.75rem]">El depósito de libros, ordenado.</h1>
          <p className="mt-4 text-base opacity-85 lg:text-lg">Cada título en su estante, cada pedido en su caja. La oficina sigue trabajando en Fierro como siempre.</p>
        </div>
        <p className="hidden text-sm opacity-80 lg:block">Recepción · Guardado · Picking · Empaque · Devoluciones · Conteos</p>
      </section>
      <section className="flex items-start justify-center bg-fondo px-6 py-10 lg:items-center">
        <div className="w-full max-w-sm">
          {cuentas.length > 0 && (
            <div className="mb-9">
              <h2 className="titulo-seccion">
                Cuentas abiertas en este dispositivo <small>{cuentas.length}</small>
              </h2>
              <ul className="lista">
                {cuentas.map((c) => (
                  <li key={c.usuario.id}>
                    <form action={cambiarCuenta}>
                      <input type="hidden" name="usuarioId" value={c.usuario.id} />
                      <button className="fila w-full gap-x-3 text-left">
                        <Avatar persona={c.usuario} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{c.usuario.nombre}</span>
                          <span className="block truncate text-sm text-suave">
                            {ROL[c.usuario.rol]} · {c.empresa.nombre}
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-acento-texto">{c.activa ? "Volver" : "Seguir"}</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h2 className="mb-1 text-xl font-bold tracking-[-0.02em]">{cuentas.length > 0 ? "Agregar otra cuenta" : "Ingresar"}</h2>
          {llena && <p className="mb-4 text-sm text-suave">{`Este dispositivo ya tiene ${MAXIMO_CUENTAS} cuentas abiertas. Si entrás con otra, se cierra la que hace más tiempo no se usa.`}</p>}
          <div className={cuentas.length > 0 ? "" : "mt-4"}>
            <Ingreso />
          </div>
        </div>
      </section>
    </div>
  );
}
