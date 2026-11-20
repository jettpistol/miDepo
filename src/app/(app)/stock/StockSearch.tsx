"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

/** Stock search: results appear as you type, without pressing the button. */
export function StockSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <form className="field-group search-box mb-6" role="search" action="/stock">
      <input
        name="q"
        type="search"
        defaultValue={initial}
        className="field"
        placeholder="Nombre, autor, ISBN, SKU o ubicación"
        aria-label="Buscar"
        autoComplete="off"
        onChange={(e) => {
          const q = e.target.value.trim();
          clearTimeout(timer.current);
          timer.current = setTimeout(() => router.replace(q ? `/stock?q=${encodeURIComponent(q)}` : "/stock", { scroll: false }), 250);
        }}
      />
      <button className="btn" aria-label="Buscar">
        <Icon name="stock" />
      </button>
    </form>
  );
}
