import Link from "next/link";
import type { ReactNode } from "react";
import { BarraInferior, Secciones } from "@/components/Navegacion";
import { Avatar } from "@/components/Avatar";
import { Cuentas, ROL } from "@/components/Cuentas";
import { Desplegable } from "@/components/Desplegable";
import { Icono } from "@/components/Icono";
import { Marca } from "@/components/Marca";
import { MENU } from "@/lib/menu";
import { puede, requerir } from "@/lib/sesion";

export default async function Aplicacion({ children }: { children: ReactNode }) {
  const { usuario, empresa } = await requerir();
  // El manual vive en la barra azul; el resto, en la franja de secciones.
  const grupos = MENU.filter((g) => g.grupo !== "Ayuda")
    .map((g) => ({ ...g, items: g.items.filter((i) => puede(usuario.rol, i.minimo ?? "operario")) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <div className="no-imprimir sticky top-0 z-30">
        <header className="bg-acento text-sobre-acento">
          <div className="mx-auto flex h-13 max-w-[1360px] items-center gap-4 px-4 sm:px-6 xl:px-10">
            <Link href="/" className="-ml-1 rounded-control px-1 py-1">
              <Marca />
            </Link>
            <span className="min-w-0 flex-1 truncate border-l border-sobre-acento/25 pl-4 text-sm font-medium opacity-85">{empresa.nombre}</span>

            <Link href="/ayuda" className="hidden items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm font-medium opacity-85 transition-opacity duration-150 hover:opacity-100 lg:flex">
              <Icono nombre="ayuda" className="size-4.5" />
              Manual
            </Link>

            <Desplegable key={usuario.id} className="group relative hidden lg:block">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-control py-1 pr-1.5 pl-1 transition-colors duration-150 hover:bg-sobre-acento/12 [&::-webkit-details-marker]:hidden">
                <Avatar persona={usuario} clase="size-8 text-xs ring-1 ring-sobre-acento/50" />
                <span className="text-left leading-tight">
                  <span className="block max-w-44 truncate text-sm font-semibold">{usuario.nombre}</span>
                  <span className="block text-xs opacity-75">{ROL[usuario.rol]}</span>
                </span>
                <Icono nombre="flecha" className="size-4 rotate-90 opacity-75 transition-transform duration-150 group-open:-rotate-90" />
              </summary>
              <div className="absolute top-full right-0 mt-2 w-72 rounded-control border border-borde bg-superficie p-1.5 text-texto shadow-flotante">
                <Cuentas />
              </div>
            </Desplegable>

            <Link href="/mas" className="flex items-center lg:hidden" aria-label={`Menú y cuentas. En uso: ${usuario.nombre}`}>
              <Avatar persona={usuario} clase="size-8 text-xs ring-1 ring-sobre-acento/50" />
            </Link>
          </div>
        </header>
        <Secciones grupos={grupos} />
      </div>

      <main className="mx-auto w-full max-w-[1360px] min-w-0 px-4 pt-6 pb-28 sm:px-6 lg:pt-8 lg:pb-16 xl:px-10">{children}</main>
      <BarraInferior />
    </>
  );
}
