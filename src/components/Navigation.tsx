"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "@/lib/menu";
import { Icon } from "./Icon";

const active = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

/** Left sidebar (desktop): grouped sections, with how many items wait in each queue. */
export function Sidebar({ groups, counts }: { groups: { group: string; items: MenuItem[] }[]; counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-4 px-3 py-3" aria-label="Menú principal">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="mb-1 px-2 text-xs font-semibold text-muted">{g.group}</p>
          <ul className="space-y-px">
            {g.items.map((i) => {
              const on = active(pathname, i.href);
              const n = counts[i.href] ?? 0;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={on ? "page" : undefined}
                    title={i.help}
                    className={`relative flex h-8 items-center gap-2.5 rounded-control px-2 text-sm transition-colors duration-150 ${on ? "bg-accent-soft font-semibold text-accent-text before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-text" : "font-medium text-ink hover:bg-sunken"}`}
                  >
                    <Icon name={i.icon} className={`size-4 ${on ? "" : "text-muted"}`} />
                    <span className="min-w-0 flex-1 truncate">{i.name}</span>
                    {n > 0 && <span className={`min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-semibold tabular-nums ${on ? "bg-surface text-accent-text" : "bg-sunken text-muted"}`}>{n > 99 ? "99+" : n}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
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
