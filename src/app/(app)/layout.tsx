import Link from "next/link";
import type { ReactNode } from "react";
import { BarraInferior, Lateral } from "@/components/Navegacion";
import { Avatar } from "@/components/Avatar";
import { Cuentas, ROL } from "@/components/Cuentas";
import { Desplegable } from "@/components/Desplegable";
import { Icono } from "@/components/Icono";
import { Marca } from "@/components/Marca";
import { MENU } from "@/lib/menu";
import { puede, requerir } from "@/lib/sesion";

export default async function Aplicacion({ children }: { children: ReactNode }) {
  const { usuario, empresa } = await requerir();
  const grupos = MENU.map((g) => ({ ...g, items: g.items.filter((i) => puede(usuario.rol, i.minimo ?? "operario")) })).filter((g) => g.items.length > 0);

  return (
    <div className="lg:flex">
      <aside className="no-imprimir sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-acento text-sobre-acento lg:flex">
        <Link href="/" className="px-6 pt-6 pb-2">
          <Marca />
          <span className="mt-0.5 block text-sm opacity-70">{empresa.nombre}</span>
        </Link>
        <Lateral grupos={grupos} />
        <Desplegable key={usuario.id} className="group relative border-t border-sobre-acento/15">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4 hover:bg-sobre-acento/10 [&::-webkit-details-marker]:hidden">
            <Avatar persona={usuario} clase="size-9 text-sm ring-2 ring-sobre-acento/40" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{usuario.nombre}</span>
              <span className="block text-xs opacity-70">{ROL[usuario.rol]}</span>
            </span>
            <Icono nombre="flecha" className="size-4 -rotate-90 opacity-70 transition group-open:rotate-90" />
          </summary>
          <div className="tarjeta absolute inset-x-2 bottom-full mb-1 p-1.5 text-texto shadow-xl">
            <Cuentas />
          </div>
        </Desplegable>
      </aside>

      <header className="no-imprimir sticky top-0 z-30 flex items-center justify-between bg-acento px-4 py-3 text-sobre-acento lg:hidden">
        <Link href="/">
          <Marca />
        </Link>
        <Link href="/mas" className="flex min-w-0 items-center gap-2.5" aria-label={`Menú y cuentas. En uso: ${usuario.nombre}`}>
          <span className="truncate text-sm opacity-80">{empresa.nombre}</span>
          <Avatar persona={usuario} clase="size-8 text-xs ring-2 ring-sobre-acento/40" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">{children}</main>
      <BarraInferior />
    </div>
  );
}
