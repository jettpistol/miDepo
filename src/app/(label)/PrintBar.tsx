"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LabelKind } from "@/lib/labels/kinds";
import { Icon } from "@/components/Icon";
import { InfoHint } from "@/components/Hint";
import { Select, type Option } from "@/components/Select";
import { toast } from "@/components/Toast";
import { hotkey } from "@/lib/hotkeys";
import { keepForComputer, send } from "./actions";

/** The bar above a print view: size, printer, Imprimir. Not printed. */
export function PrintBar(p: {
  source: string;
  kind: LabelKind;
  title: string;
  total: number;
  sizes: Option[];
  sizeId: string;
  printers: Option[];
  printerId: number | null;
  direct: boolean;
  isDefault: boolean;
  canKeep: boolean;
  auto: boolean;
  printed: number;
}) {
  const router = useRouter();
  const path = usePathname();
  const query = useSearchParams();
  const [busy, start] = useTransition();
  const [kept, setKept] = useState(false);
  const autoDone = useRef(false);

  const go = (k: string, v: string) => {
    const q = new URLSearchParams(query);
    q.set(k, v);
    q.delete("auto");
    router.replace(`${path}?${q}`, { scroll: false });
  };

  const print = () =>
    start(async () => {
      const r = await send(p.source, p.printerId, p.sizeId);
      if (r.error) return toast(r.error, true);
      if (r.dialog) window.print();
      else if (r.ok) toast(r.ok, false);
      router.refresh();
    });

  useEffect(() => {
    // Opened with one click from Etiquetas: print straight away.
    if (p.auto && !autoDone.current && p.total > 0) {
      autoDone.current = true;
      print();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.auto]);

  return (
    <div className="no-print sticky top-0 z-10 border-b border-line bg-surface text-ink">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 px-4 py-2.5">
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-semibold">{p.title}</p>
          <p className="text-[13px] text-muted">
            {p.total === 1 ? "1 etiqueta" : `${p.total} etiquetas`}
            {p.printed > 0 && ` · impresa ${p.printed === 1 ? "1 vez" : `${p.printed} veces`}`}
          </p>
        </div>
        <div className="w-full sm:w-52">
          <span className="field-label">Tamaño</span>
          <Select label="Tamaño" options={p.sizes} value={p.sizeId} onChange={(v) => go("tamano", v)} />
        </div>
        <div className="w-full sm:w-60">
          <span className="field-label flex items-center gap-1">
            Impresora
            {!p.direct && <InfoHint text="En el diálogo: tamaño de papel igual a la etiqueta, márgenes Ninguno, escala 100 %." />}
          </span>
          <Select label="Impresora" options={p.printers} value={p.printerId ? String(p.printerId) : "dialogo"} onChange={(v) => go("impresora", v)} />
        </div>
        {p.canKeep && !p.isDefault && !kept && (
          <button
            type="button"
            className="btn-soft"
            onClick={async () => {
              const r = await keepForComputer(p.kind, p.printerId, p.sizeId);
              if (r.error) return toast(r.error, true);
              setKept(true);
              toast("Guardado.", false);
            }}
          >
            Fijar en este equipo
          </button>
        )}
        <button type="button" className="btn" disabled={busy || p.total === 0} onClick={print} {...hotkey("primary", "Imprimir")}>
          <Icon name="print" className="size-4.5" />
          {busy ? "Un momento…" : "Imprimir"}
        </button>
      </div>
    </div>
  );
}
