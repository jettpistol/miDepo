"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchResults } from "@/app/api/search/route";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { ShelfMark } from "./ui";

export type Tab = "funciones" | "inventario" | "guias";
const TABS: { id: Tab; name: string }[] = [
  { id: "funciones", name: "Funciones" },
  { id: "inventario", name: "Inventario" },
  { id: "guias", name: "Guías" },
];

/** One row of the popup, whatever it came from. */
export type SearchRow = { key: string; group?: string; title: string; path: string[]; href: string; icon?: IconName; shelf?: string; aside?: string; keys?: string; excerpt?: string; exact?: boolean };
type Group = { name?: string; rows: SearchRow[] };
/** What a screen is called in a path → its icon, for documents. */
const SCREEN_ICON: Record<string, IconName> = { Picking: "picking", Empaque: "packing", Recepción: "receiving", Devoluciones: "return", Conteos: "count", Proveedores: "supplier", Clientes: "customer" };

const RECENT_KEY = "midepo.search.recent";
const RECENT_MAX = 6;
type Recent = SearchRow & { tab: Tab };

function readRecent(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function remember(row: SearchRow, tab: Tab) {
  try {
    const list = [{ ...row, tab, exact: undefined }, ...readRecent().filter((r) => r.href !== row.href)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // A private window or blocked storage: the search works the same, without recent items.
  }
}

/** Typing in a field (or a scan form): "/" there is a character, not the search shortcut. */
const editing = (el: Element | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

const EMPTY: SearchResults = { funciones: [], inventario: [], guias: [] };

/**
 * The search in the top bar: screens, actions and settings (Funciones), articles, locations and
 * documents (Inventario) and the manual (Guías), each a tab of the same popup. Ctrl+K or "/" goes
 * to it from anywhere; Tab switches tabs. On a phone it opens full screen.
 */
export function GlobalSearch({ starters }: { starters: SearchRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState<Tab>("funciones");
  const [picked, setPicked] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [forQuery, setForQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const q = query.trim();

  // Results follow the typing, the last request winning.
  useEffect(() => {
    if (q.length === 0) {
      setResults(EMPTY);
      setForQuery("");
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        if (!r.ok) return;
        const body: SearchResults = await r.json();
        setResults(body);
        setForQuery(q);
        setActive(0);
      } catch {
        // Aborted by the next keystroke, or offline: the previous results stay.
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  // Until the person picks a tab, the popup shows where the results are: a scan's match first.
  useEffect(() => {
    if (picked || !forQuery) return;
    const r = results;
    const best: Tab = r.inventario.some((h) => h.exact) ? "inventario" : r.funciones.length ? "funciones" : r.inventario.length ? "inventario" : r.guias.length ? "guias" : tab;
    setTab(best);
    // `tab` is left out on purpose: this runs when results arrive, not when the tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, forQuery, picked]);

  const groups: Group[] = useMemo(() => {
    if (!q) {
      const mine = recent.filter((r) => r.tab === tab);
      const out: Group[] = mine.length ? [{ name: "Recientes", rows: mine }] : [];
      // Before typing, Funciones lists the screens by sidebar group, like the sidebar.
      if (tab === "funciones")
        for (const name of [...new Set(starters.map((r) => r.group))]) out.push({ name, rows: starters.filter((r) => r.group === name && !mine.some((m) => m.href === r.href)) });
      return out;
    }
    if (tab === "funciones") return [{ rows: results.funciones.map((f) => ({ key: f.href + f.title, title: f.title, path: f.path, href: f.href, icon: f.icon, keys: f.keys })) }];
    if (tab === "guias") return [{ rows: results.guias.map((g) => ({ key: g.href, title: g.section ?? g.pageTitle, path: ["Manual", ...(g.section ? [g.pageTitle] : [])], href: g.href, icon: "help" as const, excerpt: g.excerpt })) }];
    const rows = (kind: string) =>
      results.inventario
        .filter((h) => h.kind === kind)
        .map((h) => ({ key: h.href, title: h.title, path: h.path, href: h.href, aside: h.aside, exact: h.exact, icon: kind === "product" ? ("stock" as const) : SCREEN_ICON[h.path[0]], shelf: kind === "location" ? h.title : undefined }));
    const products = rows("product");
    if (products.length >= 8) products.push({ key: "all", title: `Ver todos los resultados de “${q}”`, path: ["Stock"], href: `/stock?q=${encodeURIComponent(q)}`, icon: "arrow", aside: undefined, exact: false, shelf: undefined });
    const all: Group[] = [
      { name: "Artículos", rows: products },
      { name: "Ubicaciones", rows: rows("location") },
      { name: "Proveedores y clientes", rows: rows("party") },
      { name: "Documentos", rows: rows("document") },
    ].filter((g) => g.rows.length > 0);
    // The group holding an exact match (a scan) goes first, so Enter opens it.
    return [...all.filter((g) => g.rows.some((r) => r.exact)), ...all.filter((g) => !g.rows.some((r) => r.exact))];
  }, [q, tab, results, recent, starters]);

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const counts: Record<Tab, number> = { funciones: results.funciones.length, inventario: results.inventario.length, guias: results.guias.length };
  const waiting = q.length > 0 && forQuery !== q;

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const show = useCallback(() => {
    setRecent(readRecent());
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setSheet(false);
  }, []);

  // Ctrl+K (⌘K on a Mac) or "/" outside a field goes to the search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      const k = e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
      const slash = e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !editing(document.activeElement);
      if (!k && !slash) return;
      e.preventDefault();
      if (window.matchMedia("(min-width: 64rem)").matches) {
        input.current?.focus();
        input.current?.select();
      } else setSheet(true);
      show();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [show]);

  useEffect(() => {
    if (sheet) requestAnimationFrame(() => sheetInput.current?.focus());
  }, [sheet]);

  // Closes on a click outside, like any menu.
  useEffect(() => {
    if (!open || sheet) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, sheet]);

  function go(row: SearchRow) {
    remember(row, tab);
    close();
    setQuery("");
    setPicked(false);
    input.current?.blur();
    // A section of the page already open: setting the hash scrolls there and tells the page
    // (the "+ Nueva" panel listens for it), which a router push to the same page does not.
    const [path, hash] = row.href.split("#");
    if (hash && path === location.pathname) {
      if (location.hash === `#${hash}`) document.getElementById(hash)?.scrollIntoView();
      else location.hash = hash;
    }
    else router.push(row.href);
  }

  function switchTab(next: Tab) {
    setTab(next);
    setPicked(true);
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) show();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length > 0) setActive((a) => (e.key === "ArrowDown" ? (a + 1) % flat.length : (a - 1 + flat.length) % flat.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // A scan arrives as fast typing then Enter: wait for its results instead of opening an old row.
      if (waiting) return;
      const row = flat[active];
      if (row) go(row);
    } else if (e.key === "Tab" && open) {
      e.preventDefault();
      const i = TABS.findIndex((t) => t.id === tab);
      switchTab(TABS[(i + (e.shiftKey ? TABS.length - 1 : 1)) % TABS.length].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (open && !sheet) setOpen(false);
      else if (query) setQuery("");
      else {
        close();
        input.current?.blur();
      }
    }
  }

  const field = (ref: React.RefObject<HTMLInputElement | null>, extra: string) => (
    <input
      ref={ref}
      type="search"
      value={query}
      placeholder="Buscar funciones, artículos o guías"
      aria-label="Buscar"
      role="combobox"
      aria-expanded={open}
      aria-controls={`${id}-list`}
      aria-activedescendant={open && flat.length ? `${id}-row-${active}` : undefined}
      autoComplete="off"
      spellCheck={false}
      onFocus={show}
      onChange={(e) => {
        setQuery(e.target.value);
        if (!e.target.value.trim()) setPicked(false);
        setActive(0);
        if (!open) show();
      }}
      onKeyDown={onKeyDown}
      className={`w-full rounded-control border border-line-strong bg-surface pr-3 pl-8 placeholder:text-muted hover:border-ink/60 focus:border-accent-text ${extra}`}
    />
  );

  const panel = (
    <>
      <div role="tablist" aria-label="Dónde buscar" className="flex gap-1 border-b border-line px-1.5 pt-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => switchTab(t.id)}
            className={`-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-2.5 text-sm font-semibold transition-colors duration-150 lg:min-h-8 lg:text-[13px] ${tab === t.id ? "border-accent-text text-accent-text" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.name}
            {q && forQuery && <span className="rounded-full bg-sunken px-1.5 text-xs leading-5 font-semibold text-muted tabular-nums">{counts[t.id]}</span>}
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-1 self-center pr-1 text-xs text-muted lg:flex">
          <Kbd>Tab</Kbd> cambia de pestaña
        </span>
      </div>
      <div ref={list} id={`${id}-list`} role="listbox" aria-label={TABS.find((t) => t.id === tab)!.name} className="overflow-y-auto py-1 lg:max-h-[min(28rem,70dvh)]">
        {flat.length === 0 && (
          <p className="px-3 py-3 text-sm text-muted">
            {waiting ? "Buscando…" : q && results.funciones.length + results.inventario.length + results.guias.length === 0 ? `Nada coincide con “${q}”.` : q ? `Nada coincide con “${q}” en ${TABS.find((t) => t.id === tab)!.name}.` : tab === "inventario" ? "Escribe o escanea un título, ISBN, ubicación o número de documento." : "Escribe qué quieres hacer o aprender."}
          </p>
        )}
        {groups.map((g, gi) => {
          const offset = groups.slice(0, gi).reduce((n, x) => n + x.rows.length, 0);
          return (
            <div key={g.name ?? gi} role="group" aria-label={g.name}>
              {g.name && <div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted">{g.name}</div>}
              {g.rows.map((r, ri) => {
                const i = offset + ri;
                return (
                  <div
                    key={r.key}
                    id={`${id}-row-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => go(r)}
                    className={`mx-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 lg:min-h-9 lg:py-1 ${i === active ? "bg-accent-soft" : ""}`}
                  >
                    {r.shelf ? <ShelfMark code={r.shelf} className="shrink-0" /> : <Icon name={r.icon ?? "arrow"} className={`size-4 shrink-0 ${i === active ? "text-accent-text" : "text-muted"}`} />}
                    <span className="min-w-0 flex-1">
                      {!r.shelf && <span className={`block truncate text-sm font-semibold ${i === active ? "text-accent-text" : ""}`}>{r.title}</span>}
                      {r.path.length > 0 && <span className="block truncate text-xs text-muted">{r.path.join(" → ")}</span>}
                      {r.excerpt && <span className="block truncate text-xs text-muted">{r.excerpt}</span>}
                    </span>
                    {r.aside && <span className="shrink-0 text-xs text-muted tabular-nums">{r.aside}</span>}
                    {r.keys && (
                      <span className="hidden shrink-0 lg:inline">
                        <Kbd>{r.keys}</Kbd>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      <div ref={root} className="relative hidden max-w-xl flex-1 lg:block">
        <form action="/stock" role="search" onSubmit={(e) => e.preventDefault()}>
          <Icon name="stock" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          {field(input, "h-8 text-sm")}
          <input type="hidden" name="q" value={query} />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">{!query && !open && <Kbd>{mac ? "⌘ K" : "Ctrl K"}</Kbd>}</span>
        </form>
        {open && !sheet && <div className="fade-in absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-control border border-line bg-surface shadow-floating">{panel}</div>}
      </div>

      <button
        type="button"
        onClick={() => {
          setSheet(true);
          show();
        }}
        aria-label="Buscar"
        className="grid size-11 shrink-0 place-items-center rounded-full text-muted max-lg:order-1 lg:hidden"
      >
        <Icon name="stock" className="size-5" />
      </button>

      {sheet && (
        <div role="dialog" aria-modal="true" aria-label="Buscar" className="fixed inset-0 z-50 flex flex-col bg-surface lg:hidden">
          <div className="flex items-center gap-2 border-b border-line p-2">
            <div className="relative flex-1">
              <Icon name="stock" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
              {field(sheetInput, "h-11 text-base")}
            </div>
            <button type="button" onClick={close} className="min-h-11 px-2 text-sm font-semibold text-accent-text">
              Cancelar
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
        </div>
      )}
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-block rounded-label border border-line bg-sunken px-1 font-mono text-[11px] leading-4 font-semibold text-muted">{children}</kbd>;
}
