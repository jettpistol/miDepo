"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { inFloating } from "./Select";

/** A <details> that also closes on an outside tap, on Escape, or when the screen changes. */
export function Dropdown({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const close = (e: Event) => {
      if (!ref.current?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current.contains(e.target as Node) && !inFloating(e.target)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
