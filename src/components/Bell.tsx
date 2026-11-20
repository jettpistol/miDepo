"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { markAllRead, openNotice } from "@/app/(app)/avisos/actions";
import type { InboxItem } from "@/lib/notifications";
import { Dropdown } from "./Dropdown";
import { Icon } from "./Icon";
import { ActionButton } from "./ScanForm";

type Inbox = { unread: number; items: InboxItem[] };

/** How often an open screen asks for news. */
const EVERY_MS = 30_000;

export function ago(iso: string, now = Date.now()) {
  const min = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.floor(min / 60)} h`;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

/** One notice as a button: opening it marks it read and goes where it points. */
export function NoticeRow({ n, now }: { n: InboxItem; now?: number }) {
  return (
    <form action={openNotice}>
      <input type="hidden" name="id" value={n.id} />
      <button className="row w-full items-start text-left">
        <span
          aria-hidden="true"
          className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`}
        />
        <span className="min-w-0 flex-1">
          <span
            className={`block ${n.read ? "font-medium text-muted" : "font-semibold"}`}
          >
            {n.title}
            {!n.read && <span className="sr-only"> (sin leer)</span>}
          </span>
          <span className="block text-muted">{n.body}</span>
        </span>
        <time
          dateTime={n.createdAt}
          suppressHydrationWarning
          className="shrink-0 text-xs whitespace-nowrap text-muted tabular-nums"
        >
          {ago(n.createdAt, now)}
        </time>
      </button>
    </form>
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-none font-bold text-on-accent tabular-nums ring-2 ring-surface"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** The bell in the top bar: a list on desktop, a link to Avisos on phones. Asks for news every 30 s. */
export function Bell({ initial }: { initial: Inbox }) {
  const [inbox, setInbox] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);

  // A new screen brings fresh data from the server.
  useEffect(() => setInbox(initial), [initial]);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/notifications", { cache: "no-store" });
        if (r.ok && !stopped) setInbox(await r.json());
        setNow(Date.now());
      } catch {
        // No connection right now: the next round tries again.
      }
    };
    const timer = setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const label =
    inbox.unread > 0 ? `Avisos: ${inbox.unread} sin leer` : "Avisos";
  const button =
    "relative grid size-8 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink";

  return (
    <>
      <Link
        href="/avisos"
        aria-label={label}
        title={label}
        className={`${button} lg:hidden`}
      >
        <Icon name="bell" className="size-6" />
        <Count n={inbox.unread} />
      </Link>
      <Dropdown className="relative hidden lg:block" onToggle={setOpen}>
        <summary
          aria-label={label}
          title={label}
          className={`${button} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
        >
          <Icon name="bell" className="size-5" />
          <Count n={inbox.unread} />
        </summary>
        {open && (
          <div className="fade-in absolute top-full right-0 z-40 mt-1.5 w-[26rem] rounded-control border border-line bg-surface text-ink shadow-floating">
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
              <span className="text-sm font-semibold">Avisos</span>
              {inbox.unread > 0 && (
                <ActionButton
                  action={markAllRead}
                  className="link text-xs"
                  showOk={false}
                >
                  Marcar todo como leído
                </ActionButton>
              )}
            </div>
            <ul className="max-h-[60vh] overflow-y-auto [&>li+li]:border-t [&>li+li]:border-line">
              {inbox.items.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted">
                  Sin avisos
                </li>
              )}
              {inbox.items.map((n) => (
                <li key={n.id}>
                  <NoticeRow n={n} now={now} />
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-3 py-2 text-sm">
              <Link href="/avisos" className="link">
                Ver todos
              </Link>
            </div>
          </div>
        )}
      </Dropdown>
    </>
  );
}
