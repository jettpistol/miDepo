import Link from "next/link";
import { cambiarCuenta, salir, salirDeTodas } from "@/app/ingresar/acciones";
import { cuentasAbiertas, MAXIMO_CUENTAS } from "@/lib/sesion";
import { Avatar } from "./Avatar";
import { Icono } from "./Icono";

export const ROL = { operario: "Operario", supervisor: "Supervisor", admin: "Administrador" } as const;

/**
 * Las cuentas abiertas en este dispositivo: para pasar de una a otra sin volver a ingresar,
 * sumar otra o salir. Se usa en el menú lateral y en la pantalla "Más".
 */
export async function Cuentas({ mostrarActual = false }: { mostrarActual?: boolean }) {
  const cuentas = await cuentasAbiertas();
  const otras = cuentas.filter((c) => !c.activa);
  const actual = cuentas.find((c) => c.activa);
  const fila = "flex w-full cursor-pointer items-center gap-3 rounded-control px-2.5 py-2 text-left text-sm font-medium text-texto transition-colors duration-150 hover:bg-hundido";

  return (
    <div className="space-y-1">
      {actual && (
        <Link href="/cuenta" className={`${fila} ${mostrarActual ? "py-2.5" : ""}`}>
          {mostrarActual ? (
            <Avatar persona={actual.usuario} clase="size-11 text-base" />
          ) : (
            <span className="grid size-8 place-items-center">
              <Icono nombre="cuenta" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{mostrarActual ? actual.usuario.nombre : "Mi cuenta"}</span>
            <span className="block truncate text-xs text-suave">{mostrarActual ? `${ROL[actual.usuario.rol]} · ${actual.empresa.nombre} · en uso` : "Foto, colores y acceso"}</span>
          </span>
          {mostrarActual && <span className="text-sm font-semibold whitespace-nowrap text-acento-texto">Mi cuenta</span>}
          <Icono nombre="flecha" className="size-4 text-suave" />
        </Link>
      )}
      {otras.length > 0 && <p className="px-2.5 pt-2 text-[13px] font-bold text-suave">Cambiar a</p>}
      {otras.map((c) => (
        <form key={c.usuario.id} action={cambiarCuenta}>
          <input type="hidden" name="usuarioId" value={c.usuario.id} />
          <button className={fila}>
            <Avatar persona={c.usuario} clase="size-8 text-xs" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{c.usuario.nombre}</span>
              <span className="block truncate text-xs text-suave">
                {ROL[c.usuario.rol]}
                {c.empresa.id !== actual?.empresa.id && ` · ${c.empresa.nombre}`}
              </span>
            </span>
          </button>
        </form>
      ))}
      {cuentas.length < MAXIMO_CUENTAS && (
        <Link href="/ingresar?agregar=1" className={fila}>
          <span className="grid size-8 place-items-center">
            <Icono nombre="usuarios" />
          </span>
          Agregar otra cuenta
        </Link>
      )}
      <form action={salir}>
        <button className={fila}>
          <span className="grid size-8 place-items-center">
            <Icono nombre="salir" />
          </span>
          {otras.length > 0 ? `Salir de ${actual?.usuario.nombre.split(" ")[0] ?? "esta cuenta"}` : "Salir"}
        </button>
      </form>
      {otras.length > 0 && (
        <form action={salirDeTodas}>
          <button className={`${fila} text-peligro`}>
            <span className="size-8" />
            Salir de todas las cuentas
          </button>
        </form>
      )}
    </div>
  );
}
