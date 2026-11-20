"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export type RowDialog = { label: string; title: string; content: ReactNode };

/**
 * The "⋯" button at the end of a row: a small menu of that row's options. An option with a
 * form opens it in a dialog; `children` are direct actions (an ActionButton with confirm).
 * The menu lives on <body>, fixed to the screen, so a table's scroll box never clips it.
 */
export function RowMenu({ label, dialogs = [], children }: { label: string; dialogs?: RowDialog[]; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 0;
    // Opens downwards, or upwards when there is no room below.
    setPlace({ top: r.bottom + 4 + height > window.innerHeight ? Math.max(8, r.top - 4 - height) : r.bottom + 4, right: window.innerWidth - r.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => !menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const close = () => setOpen(false);
    // A scroll that leaves the button where it was (a table nudged sideways by the tap) keeps the menu.
    const at = button.current?.getBoundingClientRect();
    const moved = () => {
      const now = button.current?.getBoundingClientRect();
      if (!at || !now || Math.abs(now.top - at.top) > 2 || Math.abs(now.right - at.right) > 2) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", moved, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", moved, true);
    };
  }, [open]);

  useEffect(() => {
    if (active !== null) dialog.current?.showModal();
  }, [active]);

  const shown = active === null ? null : dialogs[active];
  return (
    <>
      <button ref={button} type="button" className="btn-icon" aria-label={label} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <Icon name="dots" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            style={place ? { top: place.top, right: place.right } : { visibility: "hidden" }}
            className="fade-in fixed z-40 flex w-56 flex-col rounded-control border border-line bg-surface py-1 shadow-floating"
          >
            {dialogs.map((d, i) => (
              <button
                key={d.label}
                type="button"
                className="menu-item"
                onClick={() => {
                  setOpen(false);
                  setActive(i);
                }}
              >
                {d.label}
              </button>
            ))}
            {children}
          </div>,
          document.body,
        )}
      {shown && (
        <dialog
          ref={dialog}
          aria-label={shown.title}
          onClose={() => {
            setActive(null);
            button.current?.focus();
          }}
          className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-control border border-line bg-surface p-4 text-left font-normal text-ink shadow-floating backdrop:bg-ink/30 lg:p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="section-title mb-0">{shown.title}</h2>
            <button type="button" className="btn-icon" aria-label="Cerrar" onClick={() => dialog.current?.close()}>
              <Icon name="close" className="size-4" />
            </button>
          </div>
          {shown.content}
        </dialog>
      )}
    </>
  );
}
