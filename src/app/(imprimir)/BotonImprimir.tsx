"use client";

export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">
      Imprimir
    </button>
  );
}
