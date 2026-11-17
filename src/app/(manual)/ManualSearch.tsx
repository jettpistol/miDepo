"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";

function Field() {
  const q = useSearchParams().get("q") ?? "";
  return (
    <form action="/ayuda" role="search" className="relative">
      <Icon name="stock" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        key={q}
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Buscar en el manual: picking, faltante, etiquetas…"
        aria-label="Buscar en el manual"
        className="field pl-9"
      />
    </form>
  );
}

/** Search box in the header. Works as a plain form: Enter shows the results. */
export function ManualSearch() {
  return (
    <Suspense fallback={<div className="h-8 rounded-control bg-sunken" />}>
      <Field />
    </Suspense>
  );
}
