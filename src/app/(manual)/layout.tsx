import Link from "next/link";
import type { ReactNode } from "react";
import { Icono } from "@/components/Icono";
import { Marca } from "@/components/Marca";
import { sesionActual } from "@/lib/sesion";
import { leerIndice, leerPie } from "@/lib/wiki";
import { Buscador } from "./Buscador";

/**
 * El manual es un sitio aparte del tablero: la misma barra azul, con buscador, y el índice a un
 * costado. Se puede leer sin haber ingresado (por ejemplo, para saber cómo ingresar).
 */
export default async function Manual({ children }: { children: ReactNode }) {
  const s = await sesionActual();
  const indice = leerIndice();
  const foco = "focus-visible:outline-sobre-acento!";
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="no-imprimir sticky top-0 z-30 bg-acento text-sobre-acento">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 xl:px-10">
          <Link href="/ayuda" className={`-ml-1 flex items-center gap-4 rounded-control px-1 py-1 ${foco}`}>
            <Marca />
            <span className="border-l border-sobre-acento/25 pl-4 text-sm font-medium opacity-85">Manual</span>
          </Link>
          <div className="order-3 w-full sm:order-none sm:mx-auto sm:w-auto sm:max-w-xl sm:flex-1">
            <Buscador />
          </div>
          <Link href={s ? "/" : "/ingresar"} className={`ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-control border border-sobre-acento/40 px-3 py-1 text-sm font-semibold transition-colors duration-150 hover:bg-sobre-acento/12 ${foco}`}>
            {s ? "Volver a miDepo" : "Ingresar"}
            <Icono nombre="flecha" className="size-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1360px] flex-1 gap-x-12 gap-y-6 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:pt-10 xl:px-10">
        <details className="border-y border-borde lg:hidden">
          <summary className="cursor-pointer px-2 py-3 text-sm font-semibold">Índice del manual</summary>
          <nav className="manual manual-indice border-t border-borde py-3 text-sm" aria-label="Índice del manual" dangerouslySetInnerHTML={{ __html: indice }} />
        </details>
        <nav className="manual manual-indice sticky top-20 -ml-2 hidden max-h-[calc(100dvh-6.5rem)] overflow-y-auto text-sm lg:block" aria-label="Índice del manual" dangerouslySetInnerHTML={{ __html: indice }} />
        <main className="min-w-0 text-[17px]">{children}</main>
      </div>

      <footer className="manual max-w-none! border-t border-borde px-4 py-5 text-center text-sm text-suave [&_p]:mb-0" dangerouslySetInnerHTML={{ __html: leerPie() }} />
    </div>
  );
}
