import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Brand } from "@/components/Brand";
import { currentSession } from "@/lib/session";
import { readIndex, readFooter } from "@/lib/wiki";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { saveTheme } from "@/app/(app)/cuenta/actions";
import { ManualSearch } from "./ManualSearch";

/**
 * The manual is a site of its own, separate from the dashboard: the same top bar, with search,
 * and the index at the side. It can be read without logging in (to find out how to log in, for one).
 */
export default async function Manual({ children }: { children: ReactNode }) {
  const s = await currentSession();
  const indexData = readIndex();
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 lg:h-12 lg:py-0">
          <Link href="/ayuda" className="-ml-1 flex items-center gap-3 rounded-control px-1 py-1 text-accent-text lg:w-[13.5rem]">
            <Brand />
            <span className="border-l border-line pl-3 text-sm font-medium text-muted">Manual</span>
          </Link>
          <div className="order-3 w-full sm:order-none sm:w-auto sm:max-w-xl sm:flex-1">
            <ManualSearch />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {s && <ThemeSwitch key={s.user.id} action={saveTheme} theme={s.user.theme} />}
            <Link href={s ? "/" : "/ingresar"} className="btn-soft">
            {s ? "Volver a miDepo" : "Ingresar"}
              <Icon name="arrow" className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1360px] flex-1 gap-x-12 gap-y-6 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:pt-8 xl:px-10">
        <details className="border-y border-line lg:hidden">
          <summary className="cursor-pointer px-2 py-3 text-sm font-semibold">Índice del manual</summary>
          <nav className="manual manual-index border-t border-line py-3 text-sm" aria-label="Índice del manual" dangerouslySetInnerHTML={{ __html: indexData }} />
        </details>
        <nav className="manual manual-index sticky top-16 -ml-2 hidden max-h-[calc(100dvh-6.5rem)] overflow-y-auto text-sm lg:block" aria-label="Índice del manual" dangerouslySetInnerHTML={{ __html: indexData }} />
        <main className="min-w-0 text-base">{children}</main>
      </div>

      <footer className="manual max-w-none! border-t border-line px-4 py-5 text-center text-sm text-muted [&_p]:mb-0" dangerouslySetInnerHTML={{ __html: readFooter() }} />
    </div>
  );
}
