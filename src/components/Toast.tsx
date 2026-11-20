"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Toast = { id: number; text: string; bad: boolean };
let listeners: ((t: Toast) => void)[] = [];
let next = 1;

/**
 * Shows an action's reply in a popup over the page, outside any table or row. Used by buttons
 * whose row may disappear once the screen refreshes (a taken order leaves the pending list).
 */
export function toast(text: string, bad: boolean) {
  const t = { id: next++, text, bad };
  listeners.forEach((l) => l(t));
}

/** Where the popups appear: bottom centre, above the phone's bottom bar. Mounted once in the root layout. */
export function Toaster() {
  const [shown, setShown] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => setShown((s) => [...s.slice(-2), t]);
    listeners.push(add);
    return () => {
      listeners = listeners.filter((l) => l !== add);
    };
  }, []);
  const close = (id: number) => setShown((s) => s.filter((t) => t.id !== id));

  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {shown.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => close(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    // A success fades by itself; an error stays until it is closed, so it can be read and quoted.
    if (t.bad) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [t.bad, onClose]);
  useEffect(() => {
    if (!t.bad) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [t.bad, onClose]);
  return (
    <div
      role={t.bad ? "alert" : "status"}
      className={`fade-in pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-control border bg-surface px-3 py-2.5 text-[15px] font-semibold shadow-floating lg:py-2 lg:text-sm ${t.bad ? "border-danger/40 text-danger" : "border-ok/40 text-ok"}`}
    >
      <Icon name={t.bad ? "warn" : "ok"} className="mt-0.5 size-5 lg:size-4" />
      <span className="min-w-0 flex-1">{t.text}</span>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="-my-1 -mr-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink lg:size-6">
        <Icon name="close" className="size-4" />
      </button>
    </div>
  );
}
