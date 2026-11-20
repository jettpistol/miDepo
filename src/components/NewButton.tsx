"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { hotkey } from "@/lib/hotkeys";
import { inFloating } from "./Select";

/** "+ Nueva": a primary button that opens a small panel with the form to create something. */
export function NewButton({ label = "Nueva", title, children }: { label?: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // "#nueva" in the address (from the top search) opens the panel, on arrival or on the same page.
  useEffect(() => {
    const fromHash = () => {
      if (location.hash !== "#nueva") return;
      history.replaceState(null, "", location.pathname + location.search);
      setOpen(true);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Opened from the keyboard (F10) or not, the cursor goes to the first field.
    root.current?.querySelector<HTMLElement>("[role=dialog] :is(input:not([type=hidden]), button, textarea)")?.focus();
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && !inFloating(e.target) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      // A dropdown inside the panel handles its own Escape first.
      if (e.key === "Escape" && !(e.target as HTMLElement).closest("[role=combobox], [aria-haspopup]")) {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button ref={button} type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)} {...hotkey("create", title)}>
        <Icon name="plus" className="size-4" />
        {label}
      </button>
      {open && (
        <div role="dialog" aria-label={title} className="fade-in absolute top-full right-0 z-30 mt-1.5 w-[min(24rem,calc(100vw-2rem))] rounded-control border border-line bg-surface p-4 shadow-floating lg:p-3">
          <h2 className="section-title">{title}</h2>
          {children}
        </div>
      )}
    </div>
  );
}
