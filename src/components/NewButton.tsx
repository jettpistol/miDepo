"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/** "+ Nueva": a primary button that opens a small panel with the form to create something. */
export function NewButton({ label = "Nueva", title, children }: { label?: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
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
      <button ref={button} type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
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
