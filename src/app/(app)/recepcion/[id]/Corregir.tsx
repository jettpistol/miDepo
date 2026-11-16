"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import type { Accion } from "@/components/Escaneo";

/** Número editable en una tabla: se guarda al salir del campo o con Enter. */
export function Corregir({ accion, ocultos, campo, valor }: { accion: Accion; ocultos: Record<string, string | number>; campo: string; valor: number }) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);

  function guardar() {
    if (texto === String(valor) || texto === "") return setTexto(String(valor));
    const datos = new FormData();
    Object.entries(ocultos).forEach(([k, v]) => datos.set(k, String(v)));
    datos.set(campo, texto);
    startTransition(() => enviar(datos));
  }

  return (
    <span className="inline-flex flex-col items-end">
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={texto}
        disabled={enviando}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label="Corregir cantidad"
        className="w-20 rounded-lg border border-borde bg-superficie px-2 py-1.5 text-right font-semibold"
      />
      {estado.error && <span className="mt-1 text-xs text-peligro">{estado.error}</span>}
    </span>
  );
}
