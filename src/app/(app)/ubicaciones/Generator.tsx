"use client";

import { useMemo, useState } from "react";
import { ActionForm, type Action } from "@/components/ScanForm";
import { ShelfMark } from "@/components/ui";
import { generateCodes, TEMPLATES, locationTotal, validateScheme, type Scheme, type Segment } from "@/lib/locations";
import { Select } from "@/components/Select";

const copy = (e: Scheme): Scheme => ({ ...e, segments: e.segments.map((t) => ({ ...t })) });

/** Pick a naming template, adjust it and preview the codes before creating them. */
export function Generator({ action, initial }: { action: Action; initial: Scheme | null }) {
  const [scheme, setScheme] = useState<Scheme>(copy(initial ?? TEMPLATES[0].scheme));
  const problem = validateScheme(scheme)?.message ?? null;
  const total = locationTotal(scheme);
  const sample = useMemo(() => (problem ? [] : generateCodes(scheme, 5)), [scheme, problem]);
  const last = useMemo(() => (problem ? "" : (generateCodes(scheme).at(-1) ?? "")), [scheme, problem]);

  const change = (i: number, patch: Partial<Segment>) => setScheme((e) => ({ ...e, id: "custom", segments: e.segments.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));

  return (
    <div className="space-y-7 lg:space-y-5">
      <fieldset>
        <legend className="field-label">1. Elige el modelo que más se parece a tu depósito</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((m) => (
            <button key={m.id} type="button" onClick={() => setScheme(copy(m.scheme))} aria-pressed={scheme.id === m.id} className={`cursor-pointer rounded-control border p-3.5 text-left transition-colors duration-150 ${scheme.id === m.id ? "border-accent-text bg-accent-soft" : "border-line hover:border-line-strong hover:bg-sunken"}`}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{m.name}</span>
                <ShelfMark code={generateCodes(m.scheme, 1)[0]} />
              </span>
              <span className="mt-1 block text-sm text-muted">{m.description}</span>
              <span className="mt-1 block text-sm">{m.audience}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="field-label">2. Ajústalo a tus medidas</legend>
        <div className="border-y border-line">
          {scheme.segments.map((t, i) => (
            <div key={i} className={`grid grid-cols-2 gap-2 py-3 lg:py-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto] sm:items-end ${i > 0 ? "border-t border-line" : ""}`}>
              <label className="text-[13px] font-semibold text-muted">
                Qué es
                <input value={t.name} onChange={(e) => change(i, { name: e.target.value })} className="field mt-1" />
              </label>
              <label className="text-[13px] font-semibold text-muted">
                Formato
                <Select
                  className="mt-1"
                  value={t.type}
                  onChange={(v) => change(i, { type: v as Segment["type"] })}
                  options={[
                    { value: "letters", label: "Letras (A, B, C…)" },
                    { value: "numbers", label: "Números (1, 2, 3…)" },
                  ]}
                />
              </label>
              <label className="text-[13px] font-semibold text-muted">
                Cantidad
                <input type="number" min={1} max={999} value={t.quantity} onChange={(e) => change(i, { quantity: Number(e.target.value) })} className="field mt-1" />
              </label>
              <label className="text-[13px] font-semibold text-muted">
                Dígitos
                <input type="number" min={1} max={4} disabled={t.type === "letters"} value={t.type === "letters" ? "" : (t.digits ?? 1)} onChange={(e) => change(i, { digits: Number(e.target.value) })} className="field mt-1" />
              </label>
              <label className="text-[13px] font-semibold text-muted">
                Prefijo
                <input value={t.prefix ?? ""} maxLength={4} onChange={(e) => change(i, { prefix: e.target.value.toUpperCase() })} className="field mt-1 font-mono" placeholder="—" />
              </label>
              <button type="button" disabled={scheme.segments.length === 1} onClick={() => setScheme((e) => ({ ...e, id: "custom", segments: e.segments.filter((_, j) => j !== i) }))} className="btn-soft">
                Quitar
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button type="button" disabled={scheme.segments.length >= 5} onClick={() => setScheme((e) => ({ ...e, id: "custom", segments: [...e.segments, { name: "Posición", type: "numbers", quantity: 4, digits: 1 }] }))} className="btn-soft">
            Agregar un tramo
          </button>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Separador
            <Select
              className="w-44 font-normal"
              value={scheme.separator}
              onChange={(v) => setScheme((x) => ({ ...x, id: "custom", separator: v }))}
              options={[
                { value: "-", label: "Guion ( - )" },
                { value: ".", label: "Punto ( . )" },
                { value: "/", label: "Barra ( / )" },
                { value: "", label: "Ninguno" },
              ]}
            />
          </label>
        </div>
      </fieldset>

      <div>
        <p className="field-label">3. Vista previa</p>
        {problem ? (
          <p className="text-sm font-semibold text-danger">{problem}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-2">
              {sample.map((c) => (
                <ShelfMark key={c} code={c} size="md" />
              ))}
              <span className="font-bold text-muted">…</span>
              <ShelfMark code={last} size="md" />
            </p>
            <p className="mt-3 text-sm text-muted">
              Son <strong className="text-ink">{total.toLocaleString("es-AR")} ubicaciones</strong> ({scheme.segments.map((t) => `${t.quantity} × ${t.name.toLowerCase()}`).join(", ")}). Las que ya existan no se tocan.
            </p>
          </>
        )}
      </div>

      <ActionForm action={action} button="Crear estas ubicaciones" resetOnOk={false}>
        <input type="hidden" name="scheme" value={JSON.stringify(scheme)} />
      </ActionForm>
    </div>
  );
}
