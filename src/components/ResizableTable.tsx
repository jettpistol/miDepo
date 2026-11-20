"use client";

import { useEffect, useRef, type ReactNode } from "react";

const DESKTOP = "(min-width: 1024px) and (pointer: fine)";
const MIN = 48;

const read = (key: string): Record<number, number> => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
};
const write = (key: string, widths: Record<number, number> | null) => {
  try {
    if (widths) localStorage.setItem(key, JSON.stringify(widths));
    else localStorage.removeItem(key);
  } catch {
    // Private window or blocked storage: the widths last until the page closes.
  }
};

/**
 * A table whose columns can be made wider or thinner on desktop by dragging the handle at the
 * right edge of a header (`<ColumnHandle />` inside the `<th>`). Widths are remembered in this
 * browser under `id`; a double click on a handle goes back to the automatic widths.
 */
export function ResizableTable({ id, className = "table-wrap", children }: { id: string; className?: string; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = wrap.current;
    const table = root?.querySelector("table");
    if (!root || !table) return;
    const key = `columns:${id}`;
    const headers = () => [...table.querySelectorAll<HTMLTableCellElement>("thead th")];
    const desktop = window.matchMedia(DESKTOP);

    const apply = (widths: Record<number, number>) => {
      const fixed = desktop.matches && Object.keys(widths).length > 0;
      table.style.tableLayout = fixed ? "fixed" : "";
      headers().forEach((th, i) => (th.style.width = fixed && widths[i] ? `${widths[i]}px` : ""));
    };
    apply(read(key));
    const onMedia = () => apply(read(key));
    desktop.addEventListener("change", onMedia);

    const onDown = (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest("[data-column-handle]");
      if (!handle || !desktop.matches) return;
      e.preventDefault();
      const all = headers();
      const th = handle.closest("th")!;
      const index = all.indexOf(th);
      // Freeze every column at its current width, then only the dragged one changes.
      const widths: Record<number, number> = {};
      all.forEach((h, i) => (widths[i] = h.getBoundingClientRect().width));
      apply(widths);
      const startX = e.clientX;
      const start = widths[index];
      document.body.classList.add("resizing-columns");
      const move = (ev: PointerEvent) => {
        widths[index] = Math.max(MIN, Math.round(start + ev.clientX - startX));
        th.style.width = `${widths[index]}px`;
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.body.classList.remove("resizing-columns");
        write(key, widths);
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    };
    const onDouble = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-column-handle]")) return;
      write(key, null);
      apply({});
    };
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("dblclick", onDouble);
    return () => {
      desktop.removeEventListener("change", onMedia);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("dblclick", onDouble);
    };
  }, [id]);

  return (
    <div ref={wrap} className={className}>
      {children}
    </div>
  );
}

/** The drag handle at the right edge of a header cell. Only shown on desktop. */
export function ColumnHandle() {
  return <span data-column-handle aria-hidden="true" title="Arrastra para cambiar el ancho; doble clic para volver al automático" className="column-handle" />;
}
