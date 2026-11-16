"use client";

import { useEffect, useRef, useState } from "react";
import { Formulario, type Accion } from "@/components/Escaneo";
import { PALETA, variablesDeAcento } from "@/lib/color";

const TEMAS = [
  { id: "sistema", nombre: "Como el dispositivo" },
  { id: "claro", nombre: "Claro" },
  { id: "oscuro", nombre: "Oscuro" },
] as const;

/** Elegir color y tema viendo el cambio en vivo en todo el sitio antes de guardar. */
export function Apariencia({ accion, acento: inicial, tema: temaInicial }: { accion: Accion; acento: string; tema: string }) {
  const [acento, setAcento] = useState(inicial.toUpperCase());
  const [tema, setTema] = useState(temaInicial);
  const guardado = useRef({ acento: inicial, tema: temaInicial });

  useEffect(() => {
    const raiz = document.documentElement;
    for (const [k, v] of Object.entries(variablesDeAcento(acento))) raiz.style.setProperty(k, v);
    raiz.dataset.tema = tema;
  }, [acento, tema]);

  // Si se sale sin guardar, el sitio vuelve a como estaba.
  useEffect(() => {
    guardado.current = { acento: inicial, tema: temaInicial };
  }, [inicial, temaInicial]);
  useEffect(
    () => () => {
      const raiz = document.documentElement;
      for (const [k, v] of Object.entries(variablesDeAcento(guardado.current.acento))) raiz.style.setProperty(k, v);
      raiz.dataset.tema = guardado.current.tema;
    },
    [],
  );

  return (
    <Formulario accion={accion} boton="Guardar apariencia" reiniciar={false} clase="space-y-6">
      <input type="hidden" name="acento" value={acento} />
      <input type="hidden" name="tema" value={tema} />
      <fieldset>
        <legend className="etiqueta">Color</legend>
        <div className="flex flex-wrap items-center gap-3">
          {PALETA.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.nombre}
              aria-label={c.nombre}
              aria-pressed={acento === c.hex}
              onClick={() => setAcento(c.hex)}
              style={{ background: c.hex, ...(acento === c.hex ? { outline: "2px solid var(--texto)", outlineOffset: 2 } : {}) }}
              className="size-10 cursor-pointer rounded-control border border-texto/15 hover:border-texto/60"
            />
          ))}
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-borde-fuerte py-1 pr-3 pl-1 text-sm font-semibold transition-colors duration-150 hover:border-texto/60 hover:bg-hundido">
            <input type="color" value={acento} onChange={(e) => setAcento(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded-rotulo border-0 bg-transparent p-0" aria-label="Elegir otro color" />
            Otro color
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="etiqueta">Tema</legend>
        <div className="flex max-w-md gap-5 border-b border-borde">
          {TEMAS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tema === t.id} onClick={() => setTema(t.id)} className={`-mb-px cursor-pointer border-b-2 px-0.5 py-2 text-sm transition-colors duration-150 ${tema === t.id ? "border-acento-texto font-bold text-acento-texto" : "border-transparent font-medium text-suave hover:text-texto"}`}>
              {t.nombre}
            </button>
          ))}
        </div>
      </fieldset>
    </Formulario>
  );
}
