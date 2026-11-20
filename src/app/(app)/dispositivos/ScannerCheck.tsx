"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui";
import { cleanScan, fixLayout, productCandidates } from "@/lib/scan";
import { forgetScanner, looksScanned, readScanner, SCANNER_EVENT, type ScannerMemory } from "@/lib/scanner";

/**
 * The scanner as this browser has seen it, and a field to try it: what arrived, whether it came
 * at scanner speed, and which setting of the scanner would fix what miDepo had to correct.
 */

const SOURCE = { scanner: "lector", camera: "cámara", demo: "lector demo" } as const;
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

type Reading = { raw: string; fast: boolean; enter: boolean; notes: string[]; read: string };

function analyse(raw: string, fast: boolean, enter: boolean, layoutDash: string | null): Reading {
  const notes: string[] = [];
  if (!enter) notes.push("Sin Enter al final: activa el sufijo Enter (CR) en el lector.");
  if (/^\][A-Za-z][0-9A-Za-z]/.test(raw)) notes.push("Prefijo AIM: miDepo lo quita. Desactívalo en el lector.");
  if (/'/.test(raw) || (layoutDash && layoutDash !== "-" && /\?/.test(raw))) notes.push('"-" llegó como "\'": el lector escribe como teclado de EE. UU. miDepo lo corrige; en el lector, elige el país del teclado igual al de Windows.');
  if (/^\d{15}$|^\d{18}$/.test(raw)) notes.push("Suplemento EAN: miDepo lo ignora. Desactívalo en el lector (Supplementals: Ignore).");
  if (/[a-zñ]/.test(raw) && raw === raw.toLowerCase() && /[a-z]/i.test(raw)) notes.push("En minúsculas: Bloq Mayús activado o lector en minúsculas.");
  if (!fast && raw.length >= 4) notes.push("Velocidad de teclado, no de lector.");
  const cleaned = cleanScan(raw);
  const read = productCandidates(cleaned).find((c) => /^\d{13}$/.test(c)) ?? fixLayout(cleaned).toUpperCase();
  return { raw, fast, enter, notes, read };
}

export function ScannerCheck() {
  const [memory, setMemory] = useState<ScannerMemory | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [dash, setDash] = useState<string | null>(null);
  const times = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () => setMemory(readScanner());
    load();
    window.addEventListener(SCANNER_EVENT, load);
    // What the key for "-" types on this computer's keyboard layout ("'" on Spanish layouts).
    const kb = (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
    kb?.getLayoutMap?.().then((m) => setDash(m.get("Minus") ?? null)).catch(() => {});
    return () => window.removeEventListener(SCANNER_EVENT, load);
  }, []);

  const finish = (enter: boolean) => {
    const raw = input.current?.value ?? "";
    if (!raw.trim()) return;
    setReading(analyse(raw, looksScanned(times.current), enter, dash));
    times.current = [];
    if (input.current) input.current.value = "";
  };

  return (
    <div className="max-w-xl space-y-4">
      <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
        <dt className="text-muted">Último escaneo</dt>
        <dd>{memory ? `${ago(memory.lastAt)} · ${SOURCE[memory.source]} · ${memory.lastCode}` : "—"}</dd>
        <dt className="text-muted">Escaneos</dt>
        <dd className="tabular-nums">{memory?.count ?? 0}</dd>
        <dt className="text-muted">Teclado de Windows</dt>
        <dd>{dash == null ? "—" : dash === "-" ? "Inglés (EE. UU.)" : "Español"}</dd>
        {memory?.noEnterAt && (
          <>
            <dt className="text-muted">Aviso</dt>
            <dd>
              <Badge tone="warn">Sin Enter</Badge> {ago(memory.noEnterAt)}: el lector no envía Enter.
            </dd>
          </>
        )}
      </dl>
      <div>
        <label htmlFor="scanner-test" className="field-label">
          Prueba del lector
        </label>
        <input
          id="scanner-test"
          ref={input}
          className="field font-mono"
          placeholder="Escanea cualquier código"
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(e) => {
            clearTimeout(timer.current);
            if (e.key === "Enter") {
              e.preventDefault();
              return finish(true);
            }
            if (e.key.length === 1 && !e.repeat) times.current.push(e.timeStamp);
            timer.current = setTimeout(() => finish(false), 600);
          }}
        />
      </div>
      {reading && (
        <div className="space-y-2 rounded-control border border-line p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted">Llegó</span> <code className="font-mono font-bold">{reading.raw}</code>
            {reading.fast ? <Badge tone="ok">Lector</Badge> : <Badge>Teclado</Badge>}
          </p>
          <p>
            <span className="text-muted">miDepo lee</span> <code className="font-mono font-bold">{reading.read}</code>
          </p>
          {reading.notes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {reading.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="text-ok">Sin correcciones.</p>
          )}
        </div>
      )}
      {memory && (
        <button type="button" className="btn-sm" onClick={forgetScanner}>
          Borrar historial
        </button>
      )}
    </div>
  );
}
