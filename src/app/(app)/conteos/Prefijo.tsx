"use client";

import { useEffect, useRef, useState } from "react";
import { Nota } from "@/components/Escaneo";
import type { Consulta, Estado } from "@/lib/consulta";

/** Campo "ubicaciones que empiezan con": dice cuántas son antes de crear el conteo. */
export function Prefijo() {
  const [estado, setEstado] = useState<Estado>();
  const campo = useRef<HTMLInputElement>(null);
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(reloj.current), []);
  // Si no va a funcionar, el navegador lo dice al querer enviar.
  useEffect(() => campo.current?.setCustomValidity(estado?.tono === "peligro" ? estado.texto : ""), [estado]);

  return (
    <div>
      <label htmlFor="prefijo" className="etiqueta">
        Ubicaciones que empiezan con
      </label>
      <input
        ref={campo}
        id="prefijo"
        name="prefijo"
        className={`campo font-mono font-bold placeholder:font-normal ${estado?.tono === "peligro" ? "border-peligro" : ""}`}
        placeholder="A-01"
        autoCapitalize="characters"
        autoComplete="off"
        aria-describedby="nota-prefijo"
        required
        onChange={(e) => {
          const q = e.target.value.trim();
          setEstado(undefined);
          clearTimeout(reloj.current);
          if (!q) return;
          reloj.current = setTimeout(async () => {
            try {
              const r = await fetch(`/api/consulta?ctx=conteo-nuevo&prefijo=${encodeURIComponent(q)}`);
              if (r.ok && campo.current?.value.trim() === q) setEstado(((await r.json()) as Consulta).estados.prefijo);
            } catch {
              /* sin red, la acción valida igual */
            }
          }, 200);
        }}
      />
      <Nota id="nota-prefijo" estado={estado} />
    </div>
  );
}
