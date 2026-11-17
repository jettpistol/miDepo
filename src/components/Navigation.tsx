"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "@/lib/menu";
import { Icon } from "./Icon";

const active = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

/** Section tabs under the blue bar (desktop). */
export function SectionTabs({ groups }: { groups: { group: string; items: MenuItem[] }[] }) {
  const pathname = usePathname();
  return (
    <nav className="no-print hidden border-b border-line bg-sunken lg:block" aria-label="Menú principal">
      <div className="mx-auto flex max-w-[1360px] items-stretch overflow-x-auto px-6 xl:px-10">
        {groups.map((g, n) => (
          <ul key={g.group} aria-label={g.group} className={`flex items-stretch ${n > 0 ? "ml-3 border-l border-line pl-3" : "-ml-3"}`}>
            {g.items.map((i) => {
              const on = active(pathname, i.href);
              return (
                <li key={i.href} className="flex">
                  <Link
                    href={i.href}
                    aria-current={on ? "page" : undefined}
                    title={i.help}
                    className={`relative flex items-center px-3 py-3 text-sm whitespace-nowrap transition-colors duration-150 ${on ? "font-bold text-accent-text after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-accent-text" : "font-medium text-muted hover:text-ink"}`}
                  >
                    {i.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </nav>
  );
}

const BAR: MenuItem[] = [
  { href: "/", name: "Inicio", icon: "home", help: "" },
  { href: "/picking", name: "Picking", icon: "picking", help: "" },
  { href: "/recepcion", name: "Recibir", icon: "receiving", help: "" },
  { href: "/stock", name: "Stock", icon: "stock", help: "" },
  { href: "/mas", name: "Más", icon: "more", help: "" },
];

/** Quick links at the bottom (phone). */
export function BottomBar() {
  const pathname = usePathname();
  const inBar = BAR.slice(0, 4).some((i) => active(pathname, i.href));
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Accesos rápidos">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {BAR.map((i) => {
          const on = i.href === "/mas" ? !inBar : active(pathname, i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 py-2 text-xs ${on ? "font-bold text-accent-text before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-accent-text" : "font-medium text-muted"}`}>
                <Icon name={i.icon} className="size-6" />
                {i.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
