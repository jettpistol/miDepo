import Link from "next/link";
import type { ReactNode } from "react";
import { BottomBar, SectionTabs } from "@/components/Navigation";
import { Avatar } from "@/components/Avatar";
import { Accounts, ROLE_LABEL } from "@/components/Accounts";
import { Dropdown } from "@/components/Dropdown";
import { Icon } from "@/components/Icon";
import { Brand } from "@/components/Brand";
import { MENU } from "@/lib/menu";
import { can, requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, company } = await requireSession();
  // The manual lives in the blue bar; everything else lives in the section tabs.
  const groups = MENU.filter((g) => g.group !== "Ayuda")
    .map((g) => ({ ...g, items: g.items.filter((i) => can(user.role, i.minRole ?? "operator")) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <div className="no-print sticky top-0 z-30">
        <header className="bg-accent text-on-accent">
          <div className="mx-auto flex h-13 max-w-[1360px] items-center gap-4 px-4 sm:px-6 xl:px-10">
            <Link href="/" className="-ml-1 rounded-control px-1 py-1">
              <Brand />
            </Link>
            <span className="min-w-0 flex-1 truncate border-l border-on-accent/25 pl-4 text-sm font-medium opacity-85">{company.name}</span>

            <Link href="/ayuda" className="hidden items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm font-medium opacity-85 transition-opacity duration-150 hover:opacity-100 lg:flex">
              <Icon name="help" className="size-4.5" />
              Manual
            </Link>

            <Dropdown key={user.id} className="group relative hidden lg:block">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-control py-1 pr-1.5 pl-1 transition-colors duration-150 hover:bg-on-accent/12 [&::-webkit-details-marker]:hidden">
                <Avatar person={user} className="size-8 text-xs ring-1 ring-on-accent/50" />
                <span className="text-left leading-tight">
                  <span className="block max-w-44 truncate text-sm font-semibold">{user.name}</span>
                  <span className="block text-xs opacity-75">{ROLE_LABEL[user.role]}</span>
                </span>
                <Icon name="arrow" className="size-4 rotate-90 opacity-75 transition-transform duration-150 group-open:-rotate-90" />
              </summary>
              <div className="absolute top-full right-0 mt-2 w-72 rounded-control border border-line bg-surface p-1.5 text-ink shadow-floating">
                <Accounts />
              </div>
            </Dropdown>

            <Link href="/mas" className="flex items-center lg:hidden" aria-label={`Menú y cuentas. En uso: ${user.name}`}>
              <Avatar person={user} className="size-8 text-xs ring-1 ring-on-accent/50" />
            </Link>
          </div>
        </header>
        <SectionTabs groups={groups} />
      </div>

      <main className="mx-auto w-full max-w-[1360px] min-w-0 px-4 pt-6 pb-28 sm:px-6 lg:pt-8 lg:pb-16 xl:px-10">{children}</main>
      <BottomBar />
    </>
  );
}
