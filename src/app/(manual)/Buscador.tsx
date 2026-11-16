"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Icono } from "@/components/Icono";

function Campo() {
  const q = useSearchParams().get("q") ?? "";
  return (
    <form action="/ayuda" role="search" className="relative">
      <Icono nombre="stock" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-acento/70" />
      <input
        key={q}
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Buscar en el manual: picking, faltante, etiquetas…"
        aria-label="Buscar en el manual"
        className="min-h-10 w-full rounded-control border border-sobre-acento bg-sobre-acento py-1.5 pr-3 pl-9 text-base text-acento placeholder:text-acento/70 focus-visible:outline-sobre-acento! sm:text-[15px]"
      />
    </form>
  );
}

/** Buscador del encabezado. Funciona como un formulario común: Enter y muestra los resultados. */
export function Buscador() {
  return (
    <Suspense fallback={<div className="h-10 rounded-control bg-sobre-acento/15" />}>
      <Campo />
    </Suspense>
  );
}
