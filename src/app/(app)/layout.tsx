import Link from "next/link";
import type { ReactNode } from "react";
import { and, count, eq, inArray } from "drizzle-orm";
import { BottomBar, Sidebar } from "@/components/Navigation";
import { Avatar } from "@/components/Avatar";
import { Accounts, ROLE_LABEL } from "@/components/Accounts";
import { Dropdown } from "@/components/Dropdown";
import { Icon } from "@/components/Icon";
import { Brand } from "@/components/Brand";
import { Hotkeys } from "@/components/Hotkeys";
import { GlobalSearch, type SearchRow } from "@/components/GlobalSearch";
import { NAV } from "@/lib/hotkeys";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { saveTheme } from "./cuenta/actions";
import { counts, orders, receivings, returns } from "@/db/schema";
import { menuFor } from "@/lib/menu";
import { can, requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { db, user, company } = await requireSession();
  const groups = menuFor(user.role, company, can);

  // How much waits in each queue, shown beside it in the sidebar.
  const c = company.id;
  const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0].n);
  const [toPick, toControl, toReceive, toPack, toReturn, toCount] = await Promise.all([
    n(db.select({ n: count() }).from(orders).where(and(eq(orders.companyId, c), inArray(orders.status, ["pending", "in_picking"])))),
    company.controlMinUnits == null ? 0 : n(db.select({ n: count() }).from(orders).where(and(eq(orders.companyId, c), eq(orders.status, "to_control")))),
    n(db.select({ n: count() }).from(receivings).where(and(eq(receivings.companyId, c), inArray(receivings.status, ["pending", "in_progress"])))),
    n(db.select({ n: count() }).from(orders).where(and(eq(orders.companyId, c), eq(orders.status, "picked")))),
    n(db.select({ n: count() }).from(returns).where(and(eq(returns.companyId, c), eq(returns.status, "in_progress")))),
    n(db.select({ n: count() }).from(counts).where(and(eq(counts.companyId, c), eq(counts.status, "open")))),
  ]);
  // What the top search offers before anything is typed: the screens this person can open.
  const altKey = Object.fromEntries(Object.entries(NAV).map(([d, href]) => [href, `Alt + ${d}`]));
  const starters: SearchRow[] = groups.flatMap((g) => g.items.map((i) => ({ key: i.href, group: g.group, title: i.name, path: [], href: i.href, icon: i.icon, keys: altKey[i.href] })));
  const queueCounts = { "/picking": toPick, "/control": toControl, "/recepcion": toReceive, "/empaque": toPack, "/devoluciones": toReturn, "/conteos": toCount };

  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface">
        <div className="flex h-13 items-center gap-3 px-4 lg:h-12 lg:gap-4 lg:px-4">
          <Link href="/" className="-ml-1 shrink-0 rounded-control px-1 py-1 text-accent-text lg:w-[13.5rem]">
            <Brand />
          </Link>
          <GlobalSearch starters={starters} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted lg:hidden">{company.name}</span>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <ThemeSwitch key={`theme-${user.id}`} action={saveTheme} theme={user.theme} />
          </div>
          <div className="ml-auto hidden items-center gap-1 lg:flex">
            <ThemeSwitch key={`theme-${user.id}`} action={saveTheme} theme={user.theme} />
            <Link href="/ayuda" title="Manual · F1: atajos de teclado" aria-label="Manual" className="grid size-8 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink">
              <Icon name="help" className="size-5" />
            </Link>
            <Dropdown key={user.id} className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-control py-1 pr-1.5 pl-1 transition-colors duration-150 hover:bg-sunken [&::-webkit-details-marker]:hidden" aria-label={`Cuenta: ${user.name}`}>
                <Avatar person={user} className="size-7 text-xs" />
                <span className="text-left leading-tight">
                  <span className="block max-w-40 truncate text-[13px] font-semibold">{user.name}</span>
                  <span className="block text-xs text-muted">{ROLE_LABEL[user.role]}</span>
                </span>
              </summary>
              <div className="absolute top-full right-0 mt-1.5 w-max max-w-72 rounded-control border border-line bg-surface p-1.5 text-ink shadow-floating">
                <Accounts />
              </div>
            </Dropdown>
          </div>

          <Link href="/mas" className="flex items-center max-lg:order-2 lg:hidden" aria-label={`Menú y cuentas. En uso: ${user.name}`}>
            <Avatar person={user} className="size-8 text-xs" />
          </Link>
        </div>
      </header>

      <div className="lg:flex">
        <aside className="no-print sticky top-12 hidden h-[calc(100dvh-3rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-surface lg:block">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-control bg-accent text-xs font-bold text-on-accent">{company.name.slice(0, 1)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{company.name}</span>
              <span className="block text-xs text-muted">Depósito</span>
            </span>
          </div>
          <Sidebar groups={groups} counts={queueCounts} />
        </aside>
        <main className="min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-6 lg:pb-12">{children}</main>
      </div>
      <BottomBar />
      <Hotkeys allowed={groups.flatMap((g) => g.items.map((i) => i.href))} names={Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.href, i.name])))} />
    </>
  );
}
