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
    <Formulario accion={accion} boton="Guardar apariencia" reiniciar={false}>
      <input type="hidden" name="acento" value={acento} />
      <input type="hidden" name="tema" value={tema} />
      <fieldset>
        <legend className="etiqueta">Color</legend>
        <div className="flex flex-wrap items-center gap-2.5">
          {PALETA.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.nombre}
              aria-label={c.nombre}
              aria-pressed={acento === c.hex}
              onClick={() => setAcento(c.hex)}
              style={{ background: c.hex }}
              className={`size-10 cursor-pointer rounded-full transition ${acento === c.hex ? "ring-3 ring-texto ring-offset-2 ring-offset-superficie" : "hover:scale-110"}`}
            />
          ))}
          <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-full border border-borde py-1.5 pr-4 pl-1.5 text-sm font-semibold">
            <input type="color" value={acento} onChange={(e) => setAcento(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Elegir otro color" />
            Otro color
          </label>
        </div>
        <p className="mt-2 text-sm text-suave">
          Usás <span className="font-mono font-semibold text-texto">{acento}</span>
          {PALETA.find((c) => c.hex === acento) ? ` (${PALETA.find((c) => c.hex === acento)!.nombre})` : ""}. Cualquier color sirve: miDepo ajusta los textos para que siempre se lean.
        </p>
      </fieldset>
      <fieldset>
        <legend className="etiqueta">Tema</legend>
        <div className="grid max-w-md grid-cols-3 gap-1 rounded-xl bg-hundido p-1">
          {TEMAS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tema === t.id} onClick={() => setTema(t.id)} className={`cursor-pointer rounded-lg px-2 py-2 text-sm font-semibold ${tema === t.id ? "bg-superficie shadow-sm" : "text-suave"}`}>
              {t.nombre}
            </button>
          ))}
        </div>
      </fieldset>
    </Formulario>
  );
}
