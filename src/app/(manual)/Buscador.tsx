"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Icono } from "@/components/Icono";

function Campo() {
  const q = useSearchParams().get("q") ?? "";
  return (
    <form action="/ayuda" role="search" className="relative">
      <Icono nombre="stock" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/60" />
      <input
        key={q}
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Buscar en el manual: picking, faltante, etiquetas…"
        aria-label="Buscar en el manual"
        className="w-full rounded-lg border border-white/20 bg-white/10 py-2 pr-3 pl-9 text-[15px] text-white placeholder:text-white/50 focus:border-white/60 focus:bg-white/15 focus:outline-none"
      />
    </form>
  );
}

/** Buscador del encabezado. Funciona como un formulario común: Enter y muestra los resultados. */
export function Buscador() {
  return (
    <Suspense fallback={<div className="h-10 rounded-lg bg-white/10" />}>
      <Campo />
    </Suspense>
  );
}
