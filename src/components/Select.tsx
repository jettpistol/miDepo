"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { plain } from "@/lib/text";
import { Icon } from "./Icon";

export type Option = { value: string; label: string; detail?: string };

/** How many matches are drawn at once; typing narrows the rest. */
const VISIBLE = 150;

/**
 * Dropdown drawn by miDepo, not the system: opens a list with a search box that stays focused,
 * so typing narrows the list while it is open. Only values from the list can be submitted.
 * With `create`, a search with no exact match offers to create that value on purpose.
 */
export function Select({
  name,
  options: initial,
  value: controlled,
  defaultValue = "",
  onChange,
  placeholder = "Elige una opción",
  label,
  id,
  required = false,
  requiredMessage = "Elige una opción de la lista.",
  searchPlaceholder = "Buscar…",
  empty = "Nada coincide.",
  create,
  className = "",
}: {
  name?: string;
  options: Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Accessible name when there is no visible label pointing at `id`. */
  label?: string;
  id?: string;
  required?: boolean;
  requiredMessage?: string;
  searchPlaceholder?: string;
  /** Shown when nothing matches the search. */
  empty?: string;
  create?: { noun: string; action: (name: string) => Promise<Option | { error: string }> };
  className?: string;
}) {
  const [options, setOptions] = useState(initial);
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const proxy = useRef<HTMLInputElement>(null);
  const auto = useId();
  const triggerId = id ?? `${auto}-trigger`;

  useEffect(() => setOptions(initial), [initial]);
  const chosen = options.find((o) => o.value === value);

  const indexed = useMemo(() => options.map((o) => ({ ...o, key: plain(`${o.label} ${o.detail ?? ""}`) })), [options]);
  const q = plain(query);
  const matches = useMemo(() => (q ? indexed.filter((o) => q.split(" ").every((w) => o.key.includes(w))) : indexed), [indexed, q]);
  // Creating is offered only when nothing on the list matches, so near-copies are picked instead of made.
  const canCreate = Boolean(create) && q.length >= 2 && matches.length === 0;
  const rows = matches.length > VISIBLE ? matches.slice(0, VISIBLE) : matches;
  const total = rows.length + (canCreate ? 1 : 0);

  // Closes on an outside click, like any menu.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // The required check lives on a hidden copy of the value so the browser can explain it at the trigger.
  useEffect(() => proxy.current?.setCustomValidity(required && !value ? requiredMessage : ""), [required, value, requiredMessage]);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function show() {
    setQuery("");
    setError(null);
    setConfirming(false);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
    requestAnimationFrame(() => search.current?.focus());
  }
  function close(refocus = true) {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }
  function choose(v: string) {
    if (controlled === undefined) setOwn(v);
    onChange?.(v);
    close();
  }
  async function add() {
    if (!create || creating) return;
    setCreating(true);
    setError(null);
    const r = await create.action(query);
    setCreating(false);
    if ("error" in r) return setError(r.error);
    setOptions((o) => [...o, r].sort((a, b) => a.label.localeCompare(b.label, "es")));
    choose(r.value);
  }
  function pick(i: number) {
    if (i < rows.length) choose(rows[i].value);
    else if (canCreate) setConfirming(true);
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <input ref={proxy} tabIndex={-1} aria-hidden="true" value={chosen?.label ?? ""} onChange={() => {}} onFocus={() => trigger.current?.focus()} className="pointer-events-none absolute inset-0 opacity-0" required={required} />
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            show();
          } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
            // Typing on the closed dropdown opens it and starts the search.
            show();
            setQuery(e.key);
          }
        }}
        className={`field flex items-center justify-between gap-2 text-left ${open ? "border-accent-text" : ""}`}
      >
        <span className={`min-w-0 truncate ${chosen ? "" : "text-muted"}`}>{chosen?.label ?? placeholder}</span>
        <Icon name="chevron" className={`size-4 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="fade-in absolute top-full right-0 left-0 z-40 mt-1 min-w-64 rounded-control border border-line bg-surface shadow-floating">
          <div className="relative border-b border-line p-1.5">
            <Icon name="stock" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input
              ref={search}
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${auto}-list`}
              aria-activedescendant={total > 0 ? `${auto}-opt-${active}` : undefined}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setError(null);
                setConfirming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (total > 0) setActive((a) => (e.key === "ArrowDown" ? (a + 1) % total : (a - 1 + total) % total));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  // Enter never creates by itself: on the create row it only asks for confirmation.
                  if (confirming) void add();
                  else if (total > 0) pick(active);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                } else if (e.key === "Tab") close(false);
              }}
              className="h-9 w-full rounded-control border border-transparent bg-sunken pr-2 pl-8 text-base outline-none placeholder:text-muted focus:border-accent-text lg:h-8 lg:text-sm"
            />
          </div>
          <ul ref={list} id={`${auto}-list`} role="listbox" aria-label={label ?? placeholder} className="max-h-64 overflow-y-auto py-1">
            {rows.map((o, i) => (
              <li
                key={o.value}
                id={`${auto}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o.value)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-[15px] lg:py-1.5 lg:text-sm ${i === active ? "bg-accent-soft" : ""}`}
              >
                <span className={`min-w-0 flex-1 truncate ${o.value === value ? "font-semibold text-accent-text" : ""}`}>{o.label}</span>
                {o.detail && <span className="shrink-0 truncate text-xs text-muted">{o.detail}</span>}
                {o.value === value && <Icon name="ok" className="size-4 shrink-0 text-accent-text" />}
              </li>
            ))}
            {canCreate && (
              <li
                id={`${auto}-opt-${rows.length}`}
                data-index={rows.length}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setConfirming(true)}
                onMouseEnter={() => setActive(rows.length)}
                className={`flex cursor-pointer items-center gap-2 border-t border-line px-3 py-2 text-[15px] font-medium text-accent-text lg:py-1.5 lg:text-sm ${active === rows.length ? "bg-accent-soft" : ""}`}
              >
                <Icon name="plus" className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{`Crear ${create!.noun} «${query.trim()}»`}</span>
              </li>
            )}
            {canCreate && confirming && (
              <li className="border-t border-line bg-sunken px-3 py-2.5 text-sm" role="presentation">
                <p>
                  No hay ningún {create!.noun} con ese nombre. ¿Crear <strong>«{query.replace(/\s+/g, " ").trim()}»</strong>? Va a quedar en la lista para todos.
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-sm border-accent bg-accent text-on-accent hover:bg-accent-hover hover:text-on-accent" disabled={creating} onClick={() => void add()}>
                    {creating ? "Creando…" : "Crear"}
                  </button>
                  <button type="button" className="btn-sm" onClick={() => { setConfirming(false); search.current?.focus(); }}>
                    Cancelar
                  </button>
                </div>
              </li>
            )}
            {total === 0 && <li className="px-3 py-2 text-sm text-muted">{empty}</li>}
          </ul>
          {matches.length > VISIBLE && <p className="border-t border-line px-3 py-1.5 text-xs text-muted">Se muestran {VISIBLE} de {matches.length}. Escribe para achicar la lista.</p>}
          {error && (
            <p role="alert" className="border-t border-line px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
