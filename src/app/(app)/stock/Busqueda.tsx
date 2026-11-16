"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/Icono";

/** Buscador de stock: los resultados aparecen mientras se escribe, sin tocar el botón. */
export function Busqueda({ inicial }: { inicial: string }) {
  const router = useRouter();
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <form className="mb-6 flex max-w-xl gap-2" role="search" action="/stock">
      <input
        name="q"
        type="search"
        defaultValue={inicial}
        className="campo"
        placeholder="Título, autor, ISBN, código o ubicación"
        aria-label="Buscar"
        autoFocus
        autoComplete="off"
        onChange={(e) => {
          const q = e.target.value.trim();
          clearTimeout(reloj.current);
          reloj.current = setTimeout(() => router.replace(q ? `/stock?q=${encodeURIComponent(q)}` : "/stock", { scroll: false }), 250);
        }}
      />
      <button className="boton px-4" aria-label="Buscar">
        <Icono nombre="stock" />
      </button>
    </form>
  );
}
