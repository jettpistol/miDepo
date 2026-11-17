import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Brand } from "@/components/Brand";
import { currentSession } from "@/lib/session";
import { readIndex, readFooter } from "@/lib/wiki";
import { ManualSearch } from "./ManualSearch";

/**
 * The manual is a site of its own, separate from the dashboard: the same blue bar, with search,
 * and the index at the side. It can be read without logging in (to find out how to log in, for one).
 */
export default async function Manual({ children }: { children: ReactNode }) {
  const s = await currentSession();
  const indexData = readIndex();
  const focusedField = "focus-visible:outline-on-accent!";
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="no-print sticky top-0 z-30 bg-accent text-on-accent">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 xl:px-10">
          <Link href="/ayuda" className={`-ml-1 flex items-center gap-4 rounded-control px-1 py-1 ${focusedField}`}>
            <Brand />
            <span className="border-l border-on-accent/25 pl-4 text-sm font-medium opacity-85">Manual</span>
          </Link>
          <div className="order-3 w-full sm:order-none sm:mx-auto sm:w-auto sm:max-w-xl sm:flex-1">
            <ManualSearch />
          </div>
          <Link href={s ? "/" : "/ingresar"} className={`ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-control border border-on-accent/40 px-3 py-1 text-sm font-semibold transition-colors duration-150 hover:bg-on-accent/12 ${focusedField}`}>
            {s ? "Volver a miDepo" : "Ingresar"}
            <Icon name="arrow" className="size-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1360px] flex-1 gap-x-12 gap-y-6 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:pt-10 xl:px-10">
        <details className="border-y border-line lg:hidden">
          <summary className="cursor-pointer px-2 py-3 text-sm font-semibold">Índice del manual</summary>
          <nav className="manual manual-index border-t border-line py-3 text-sm" aria-label="Índice del manual" dangerouslySetInnerHTML={{ __html: indexData }} />
        </details>
        <nav className="manual manual-index sticky top-20 -ml-2 hidden max-h-[calc(100dvh-6.5rem)] overflow-y-auto text-sm lg:block" aria-label="Índice del manual" dangerouslySetInnerHTML={{ __html: indexData }} />
        <main className="min-w-0 text-[17px]">{children}</main>
      </div>

      <footer className="manual max-w-none! border-t border-line px-4 py-5 text-center text-sm text-muted [&_p]:mb-0" dangerouslySetInnerHTML={{ __html: readFooter() }} />
    </div>
  );
}
