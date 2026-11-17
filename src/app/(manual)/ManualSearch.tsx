"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";

function Field() {
  const q = useSearchParams().get("q") ?? "";
  return (
    <form action="/ayuda" role="search" className="relative">
      <Icon name="stock" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-accent/70" />
      <input
        key={q}
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Buscar en el manual: picking, faltante, etiquetas…"
        aria-label="Buscar en el manual"
        className="min-h-10 w-full rounded-control border border-on-accent bg-on-accent py-1.5 pr-3 pl-9 text-base text-accent placeholder:text-accent/70 focus-visible:outline-on-accent! sm:text-[15px]"
      />
    </form>
  );
}

/** Search box in the header. Works as a plain form: Enter shows the results. */
export function ManualSearch() {
  return (
    <Suspense fallback={<div className="h-10 rounded-control bg-on-accent/15" />}>
      <Field />
    </Suspense>
  );
}
