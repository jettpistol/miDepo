"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Un <details> que además se cierra al tocar afuera, con Escape o al cambiar de pantalla. */
export function Desplegable({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const ruta = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [ruta]);

  useEffect(() => {
    const cerrar = (e: Event) => {
      if (!ref.current?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", cerrar);
    document.addEventListener("keydown", cerrar);
    return () => {
      document.removeEventListener("pointerdown", cerrar);
      document.removeEventListener("keydown", cerrar);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
