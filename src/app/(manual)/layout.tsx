import Link from "next/link";
import type { ReactNode } from "react";
import { Icono } from "@/components/Icono";
import { Marca } from "@/components/Marca";
import { sesionActual } from "@/lib/sesion";
import { leerIndice, leerPie } from "@/lib/wiki";
import { Buscador } from "./Buscador";

/**
 * El manual es un sitio aparte del tablero: encabezado negro con buscador, índice a un costado.
 * Se puede leer sin haber ingresado (por ejemplo, para saber cómo ingresar).
 */
export default async function Manual({ children }: { children: ReactNode }) {
  const s = await sesionActual();
  const indice = leerIndice();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-imprimir sticky top-0 z-30 bg-black text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/ayuda" className="flex items-center gap-3">
            <Marca />
            <span className="rounded-md border border-white/25 px-2 py-0.5 text-xs font-semibold tracking-widest uppercase">Manual</span>
          </Link>
          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <Buscador />
          </div>
          <Link href={s ? "/" : "/ingresar"} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-black hover:bg-white/85">
            {s ? "Volver a miDepo" : "Ingresar"}
            <Icono nombre="flecha" className="size-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:py-8">
        <details className="tarjeta lg:hidden">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Índice del manual</summary>
          <nav className="manual manual-indice border-t border-borde px-4 py-3 text-sm" aria-label="Índice del manual" dangerouslySetInnerHTML={{ __html: indice }} />
        </details>
        <main className="min-w-0">{children}</main>
        <nav className="manual manual-indice tarjeta sticky top-20 hidden max-h-[calc(100dvh-6.5rem)] overflow-y-auto p-4 text-sm lg:block" aria-label="Índice del manual" dangerouslySetInnerHTML={{ __html: indice }} />
      </div>

      <footer className="manual border-t border-borde px-4 py-5 text-center text-sm text-suave [&_p]:mb-0" dangerouslySetInnerHTML={{ __html: leerPie() }} />
    </div>
  );
}
