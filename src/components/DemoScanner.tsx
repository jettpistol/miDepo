"use client";

import { useCallback, useEffect, useState } from "react";
import { DEMO_SCAN_EVENT, type DemoScan } from "@/lib/scanner";
import { Icon } from "./Icon";
import { Toggle } from "./Toggle";
import { toast } from "./Toast";

/**
 * Test mode's scanner: reads a code into the scan field in use, through the same path as the
 * camera (ScanForm). It can read like a misconfigured scanner, to try the clean-up: a US
 * keyboard on a Spanish PC ("-" arrives as "'"), no Enter, an AIM prefix, an EAN add-on.
 */

/** The scan field being filled: the focused one, else the first empty one on screen. */
function targetField() {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && active.matches("[data-scan-field]")) return active;
  const all = [...document.querySelectorAll<HTMLInputElement>("[data-scan-field]")];
  return all.find((e) => !e.value) ?? all[0] ?? null;
}

/** Codes shown on screen (shelf marks, codes): what an operator would scan next. */
function codesOnScreen() {
  return [...new Set([...document.querySelectorAll<HTMLElement>("main [data-code]")].map((e) => e.dataset.code!).filter(Boolean))].slice(0, 8);
}

export function DemoScanner() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [usKeyboard, setUs] = useState(false);
  const [noEnter, setNoEnter] = useState(false);
  const [aim, setAim] = useState(false);
  const [addOn, setAddOn] = useState(false);

  useEffect(() => {
    if (!open) return;
    const refresh = () => setCodes(codesOnScreen());
    refresh();
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [open]);

  const scan = useCallback(
    (raw: string) => {
      const target = targetField();
      if (!target) return toast("Sin campo de escaneo en esta pantalla.", true);
      let read = raw.trim();
      if (!read) return;
      if (addOn && /^\d{13}$/.test(read)) read += "01";
      if (usKeyboard) read = read.replace(/-/g, "'").replace(/_/g, "?");
      if (aim) read = (/^\d{13}/.test(read) ? "]E0" : "]C0") + read;
      window.dispatchEvent(new CustomEvent<DemoScan>(DEMO_SCAN_EVENT, { detail: { target, code: read, enter: !noEnter } }));
    },
    [addOn, aim, noEnter, usKeyboard],
  );

  return (
    <div className="no-print fixed right-4 bottom-20 z-40 lg:bottom-4">
      {open ? (
        <div role="dialog" aria-label="Lector demo" className="w-72 rounded-control border border-line-strong bg-surface p-3 shadow-floating">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Lector demo</p>
            <button type="button" className="btn-ghost btn-sm" aria-label="Cerrar" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <form
            className="field-group"
            onSubmit={(e) => {
              e.preventDefault();
              scan(code);
            }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código" aria-label="Código" className="field font-mono" autoCapitalize="characters" spellCheck={false} />
            {/* mousedown: the scan field keeps the focus */}
            <button className="btn" onMouseDown={(e) => e.preventDefault()}>
              Leer
            </button>
          </form>
          {codes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {codes.map((c) => (
                <button key={c} type="button" className="btn-sm font-mono" onMouseDown={(e) => e.preventDefault()} onClick={() => scan(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 divide-y divide-line" onMouseDown={(e) => e.preventDefault()}>
            <Toggle label="Teclado US" hint={'Lector configurado en inglés sobre Windows en español: "-" llega como "\'".'} defaultChecked={usKeyboard} onChange={setUs} />
            <Toggle label="Sin Enter" hint="Lector sin sufijo Enter." defaultChecked={noEnter} onChange={setNoEnter} />
            <Toggle label="Prefijo AIM" hint="]E0 o ]C0 antes del código." defaultChecked={aim} onChange={setAim} />
            <Toggle label="Suplemento EAN" hint="Dos dígitos después de un EAN-13." defaultChecked={addOn} onChange={setAddOn} />
          </div>
        </div>
      ) : (
        <button type="button" className="btn-soft shadow-floating" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(true)}>
          <Icon name="barcode" /> Lector demo
        </button>
      )}
    </div>
  );
}
