import Link from "next/link";
import type { ReactNode } from "react";
import { BarraInferior, Lateral } from "@/components/Navegacion";
import { Icono } from "@/components/Icono";
import { Marca } from "@/components/Marca";
import { MENU } from "@/lib/menu";
import { puede, requerir } from "@/lib/sesion";
import { salir } from "../ingresar/acciones";

const ROL = { operario: "Operario", supervisor: "Supervisor", admin: "Administrador" } as const;

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
        <div className="border-t border-sobre-acento/15 p-4">
          <p className="truncate text-sm font-semibold">{usuario.nombre}</p>
          <p className="text-xs opacity-70">{ROL[usuario.rol]}</p>
          <form action={salir}>
            <button className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-medium opacity-80 hover:opacity-100">
              <Icono nombre="salir" className="size-4" /> Salir
            </button>
          </form>
        </div>
      </aside>

      <header className="no-imprimir sticky top-0 z-30 flex items-center justify-between bg-acento px-4 py-3 text-sobre-acento lg:hidden">
        <Link href="/">
          <Marca />
        </Link>
        <span className="max-w-[45%] truncate text-sm opacity-80">{empresa.nombre}</span>
      </header>

      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">{children}</main>
      <BarraInferior />
    </div>
  );
}
