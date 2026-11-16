"use client";

import { Icono } from "@/components/Icono";

export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-control bg-sobre-acento px-4 py-1.5 text-sm font-semibold text-acento transition-colors duration-150 hover:bg-sobre-acento/88 focus-visible:outline-sobre-acento!">
      <Icono nombre="imprimir" className="size-4.5" />
      Imprimir
    </button>
  );
}
