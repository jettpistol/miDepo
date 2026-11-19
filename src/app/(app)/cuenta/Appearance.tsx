"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm, type Action } from "@/components/ScanForm";
import { PALETTE, accentVariables } from "@/lib/color";
import { FONTS, fontVar } from "@/lib/fonts";

const THEMES = [
  { id: "system", name: "Como el dispositivo" },
  { id: "light", name: "Claro" },
  { id: "dark", name: "Oscuro" },
] as const;

/** Pick a colour, theme and font and watch the whole site change live before saving. */
export function Appearance({ action, accent: initial, theme: initialTheme, font: initialFont }: { action: Action; accent: string; theme: string; font: string }) {
  const [accent, setAccent] = useState(initial.toUpperCase());
  const [theme, setTheme] = useState(initialTheme);
  const [font, setFont] = useState(initialFont);
  const saved = useRef({ accent: initial, theme: initialTheme, font: initialFont });

  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(accentVariables(accent))) root.style.setProperty(k, v);
    root.dataset.theme = theme;
    root.style.setProperty("--font-ui", fontVar(font));
  }, [accent, theme, font]);

  // Leaving without saving puts the site back the way it was.
  useEffect(() => {
    saved.current = { accent: initial, theme: initialTheme, font: initialFont };
  }, [initial, initialTheme, initialFont]);
  // The top-bar switch saves the theme on its own; follow it.
  useEffect(() => setTheme(initialTheme), [initialTheme]);
  useEffect(
    () => () => {
      const root = document.documentElement;
      for (const [k, v] of Object.entries(accentVariables(saved.current.accent))) root.style.setProperty(k, v);
      root.dataset.theme = saved.current.theme;
      root.style.setProperty("--font-ui", fontVar(saved.current.font));
    },
    [],
  );

  return (
    <ActionForm action={action} button="Guardar apariencia" resetOnOk={false} className="space-y-6">
      <input type="hidden" name="accent" value={accent} />
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="font" value={font} />
      <fieldset>
        <legend className="field-label">Color</legend>
        <div className="flex flex-wrap items-center gap-3">
          {PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={accent === c.hex}
              onClick={() => setAccent(c.hex)}
              style={{ background: c.hex, ...(accent === c.hex ? { outline: "2px solid var(--ink)", outlineOffset: 2 } : {}) }}
              className="size-10 lg:size-8 cursor-pointer rounded-control border border-ink/15 hover:border-ink/60"
            />
          ))}
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line-strong py-1 pr-3 pl-1 text-sm font-semibold transition-colors duration-150 hover:border-ink/60 hover:bg-sunken">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded-label border-0 bg-transparent p-0" aria-label="Elegir otro color" />
            Otro color
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="field-label">Tema</legend>
        <div className="flex max-w-md gap-5 border-b border-line">
          {THEMES.map((t) => (
            <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => setTheme(t.id)} className={`-mb-px cursor-pointer border-b-2 px-0.5 py-2 text-sm transition-colors duration-150 ${theme === t.id ? "border-accent-text font-bold text-accent-text" : "border-transparent font-medium text-muted hover:text-ink"}`}>
              {t.name}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="field-label">Letra</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={font === f.id}
              onClick={() => setFont(f.id)}
              style={{ fontFamily: fontVar(f.id) }}
              className={`cursor-pointer rounded-control border px-3 py-2 text-left transition-colors duration-150 ${font === f.id ? "border-accent-text bg-accent-soft" : "border-line hover:border-line-strong hover:bg-sunken"}`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className={`text-[15px] font-semibold ${font === f.id ? "text-accent-text" : ""}`}>{f.name}</span>
                <span className="text-xs text-muted">{f.note}</span>
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted">Pedido PED-00042 · 64 unidades · Recepción</span>
            </button>
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}
