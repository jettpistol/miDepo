"use client";

import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "./Icon";

/**
 * A list screen's search box: the list narrows as you type (`?q=` in the address, back to page
 * one), keeping the screen's other filters.
 */
export function LiveSearch({ placeholder, className = "mb-4 max-w-xl" }: { placeholder: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const go = (q: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("pagina");
    if (q) next.set("q", q);
    else next.delete("q");
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };
  return (
    <form
      className={`field-group ${className}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        go(String(new FormData(e.currentTarget).get("q") ?? "").trim());
      }}
    >
      <input
        name="q"
        type="search"
        defaultValue={params.get("q") ?? ""}
        className="field"
        placeholder={placeholder}
        aria-label="Buscar"
        autoComplete="off"
        onChange={(e) => {
          const q = e.target.value.trim();
          clearTimeout(timer.current);
          timer.current = setTimeout(() => go(q), 250);
        }}
      />
      <button className="btn" aria-label="Buscar">
        <Icon name="stock" />
      </button>
    </form>
  );
}
