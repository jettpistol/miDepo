"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV } from "@/lib/hotkeys";

const F_KEY = /^F([2-9]|10)$/;

type Entry = { key: string; label: string; disabled: boolean };

const visible = (el: Element) => el.getClientRects().length > 0;
const isDisabled = (el: Element) => (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";
const labelOf = (el: Element) => (el.getAttribute("data-hotkey-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
const order = (key: string) => (key === "Esc" ? 99 : Number(key.slice(1)));

/** The open dialog, if any: while one is open, keys act inside it only. */
const scope = (): ParentNode => document.querySelector("[role=dialog]") ?? document;

/** Marked elements of this screen for a key, the ones in the same form as the cursor first. */
function targets(key: string) {
  const all = [...scope().querySelectorAll(`[data-hotkey="${key}"]`)].filter(visible);
  const form = (document.activeElement as HTMLElement | null)?.closest("form");
  return form ? [...all.filter((e) => form.contains(e)), ...all.filter((e) => !form.contains(e))] : all;
}

/** Turns on the next radio of a group (the condition of a returned book), keeping the cursor where it was. */
function cycle(group: Element) {
  const radios = [...group.querySelectorAll<HTMLInputElement>("input[type=radio]")].filter((r) => !r.disabled);
  if (radios.length === 0) return;
  const next = radios[(radios.findIndex((r) => r.checked) + 1) % radios.length];
  next.checked = true;
  next.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Keyboard shortcuts for the whole app (desktop keyboards): Alt + digit opens a screen,
 * F-keys press what the screen marks with `data-hotkey`, F1 lists both.
 */
export function Hotkeys({ allowed, names }: { allowed: string[]; names: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Entry[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      const plain = !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;

      if (e.key === "F1" && plain) {
        e.preventDefault();
        // Opening: read the screen now, so the list never shows empty for a frame.
        if (!document.querySelector("[data-hotkeys-panel]")) {
          returnTo.current = document.activeElement as HTMLElement | null;
          setList(screenKeys());
        }
        setOpen((o) => !o);
        return;
      }

      // e.code, not e.key: on a Mac, Option + 1 types "¡".
      const digit = /^(Digit|Numpad)(\d)$/.exec(e.code)?.[2];
      if (digit && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const href = NAV[digit];
        if (!href || !allowed.includes(href)) return;
        e.preventDefault();
        setOpen(false);
        router.push(href);
        return;
      }

      if (!plain || !F_KEY.test(e.key)) return;
      const el = targets(e.key)[0];
      // Nothing marked with this key here: the browser keeps it (F3 still searches the page, F10 its menu).
      if (!el) return;
      e.preventDefault();
      if (isDisabled(el)) return;
      if (el.hasAttribute("data-hotkey-cycle")) cycle(el);
      else (el as HTMLElement).click();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [allowed, router]);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    // The screen can change while the list is open (a reply arrives, a step ends): the list follows it.
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setList(screenKeys()));
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-hotkey", "data-hotkey-label", "disabled"] });
    const close = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => {
      watch.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", close);
      returnTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const nav = Object.entries(NAV).filter(([, href]) => allowed.includes(href));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(4_12_48/0.4)] p-4" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div ref={panel} tabIndex={-1} data-hotkeys-panel role="dialog" aria-modal="true" aria-labelledby="hotkeys-title" className="fade-in max-h-[calc(100dvh-2rem)] w-[min(40rem,100%)] overflow-y-auto rounded-control border border-line bg-surface p-4 text-sm shadow-floating outline-none">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="hotkeys-title" className="text-base font-semibold">
            Atajos de teclado
          </h2>
          <span className="text-muted">
            <Kbd>F1</Kbd> o <Kbd>Esc</Kbd> para cerrar
          </span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <section>
            <h3 className="section-title">En esta pantalla</h3>
            {list.length === 0 ? (
              <p className="text-muted">Ninguno.</p>
            ) : (
              <dl className="space-y-1">
                {list.map((x) => (
                  <Row key={x.key + x.label} keys={[x.key]} muted={x.disabled}>
                    {x.label}
                    {x.disabled && " (ahora no se puede)"}
                  </Row>
                ))}
              </dl>
            )}
          </section>
          <section>
            <h3 className="section-title">Ir a</h3>
            <dl className="space-y-1">
              {nav.map(([digit, href]) => (
                <Row key={href} keys={["Alt", digit]}>
                  {names[href]}
                </Row>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

/** What the current screen offers, one entry per key, read from the marked elements. */
function screenKeys(): Entry[] {
  const seen = new Map<string, Entry>();
  // The list itself is not part of the screen.
  for (const el of document.querySelectorAll("[data-hotkey]")) {
    if (el.closest("[data-hotkeys-panel]")) continue;
    const key = el.getAttribute("data-hotkey")!;
    if (seen.has(key) || !visible(el)) continue;
    seen.set(key, { key, label: labelOf(el), disabled: isDisabled(el) });
  }
  if (document.querySelector("form [data-scan-field]")) seen.set("Esc", { key: "Esc", label: "Borrar lo escaneado", disabled: false });
  return [...seen.values()].sort((a, b) => order(a.key) - order(b.key));
}

function Row({ keys, muted, children }: { keys: string[]; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-baseline gap-3 ${muted ? "text-muted" : ""}`}>
      <dt className="w-16 shrink-0 whitespace-nowrap">
        {keys.map((k, i) => (
          <span key={k}>
            {i > 0 && <span className="text-muted"> + </span>}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-block min-w-6 rounded-label border border-line-strong bg-sunken px-1 text-center font-mono text-xs leading-5 font-semibold text-ink">{children}</kbd>;
}
