"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/ScanForm";
import { Badge, Notice, plural } from "@/components/ui";
import { articleName } from "@/lib/article";
import type { LoadCheck } from "@/lib/flows/stockLoad";
import { check, load } from "./actions";

const SHOWN = 200;

/** Pick the file, see every row checked, then load. Nothing is saved until "Cargar". */
export function LoadForm() {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<LoadCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

  async function pick(f: File | undefined) {
    setResult(null);
    setError(null);
    if (!f) return setFile(null);
    const text = await f.text();
    setFile({ name: f.name, text });
    startCheck(async () => {
      const r = await check(text);
      if ("error" in r) setError(r.error);
      else setResult(r);
    });
  }

  const bad = result?.rows.filter((r) => r.error) ?? [];
  const rows = bad.length > 0 ? bad : (result?.rows ?? []);
  const reason = !result
    ? "Elige el archivo primero."
    : result.tooMany
      ? "El archivo tiene demasiadas filas. Divídelo en varios."
      : result.lines === 0
        ? "El archivo no tiene filas para cargar."
        : bad.length > 0
          ? `${plural(bad.length, "fila tiene", "filas tienen")} errores.`
          : undefined;

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <label htmlFor="file" className="field-label">
          Archivo CSV
        </label>
        <input
          id="file"
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="field" onChange={(e) => {
            pick(e.target.files?.[0]);
            // Choosing the same file again after fixing it must check it again.
            e.target.value = "";
          }}
        />
      </div>
      {checking && <p className="text-muted">Revisando…</p>}
      {error && <Notice tone="danger">{error}</Notice>}
      {result && (
        <>
          <p>
            {file && <span className="font-mono text-xs">{file.name} · </span>}
            <strong>{plural(result.lines, "fila", "filas")}</strong> · {plural(result.units, "unidad", "unidades")}
            {bad.length > 0 && (
              <>
                {" "}
                · <span className="font-semibold text-danger">{plural(bad.length, "con error", "con errores")}</span>
              </>
            )}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-right">Fila</th>
                  <th>Código</th>
                  <th className="hidden sm:table-cell">Artículo</th>
                  <th className="hidden text-right sm:table-cell">Cantidad</th>
                  <th>Ubicación</th>
                  <th>{bad.length > 0 ? "Error" : ""}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, SHOWN).map((r) => (
                  <tr key={r.line}>
                    <td className="w-px text-right text-muted tabular-nums">{r.line}</td>
                    <td className="font-mono text-xs whitespace-nowrap">{r.code || "—"}</td>
                    <td className="hidden max-w-0 w-full truncate sm:table-cell">{r.title ? articleName(r.title) : <span className="text-muted">—</span>}</td>
                    <td className="hidden text-right tabular-nums sm:table-cell">{r.quantity || "—"}</td>
                    <td className="font-mono text-xs whitespace-nowrap">{r.locationCode ?? (r.location || "—")}</td>
                    <td className="whitespace-nowrap">{r.error ? <Badge tone="danger">{r.error}</Badge> : <Badge tone="ok">Correcta</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > SHOWN && <p className="text-muted">{plural(rows.length - SHOWN, "fila más", "filas más")}.</p>}
        </>
      )}
      <ActionForm
        action={load}
        button={result && !reason ? `Cargar ${plural(result.units, "unidad", "unidades")}` : "Cargar"}
        reason={reason}
        hotkey="primary"
        confirm={result ? `¿Cargar ${plural(result.units, "unidad", "unidades")} como stock inicial? Entran a sus ubicaciones sin pasar por Recepción y no se informan a Fierro.` : undefined}
      >
        <input type="hidden" name="text" value={file?.text ?? ""} />
        <input type="hidden" name="fileName" value={file?.name ?? ""} />
      </ActionForm>
    </div>
  );
}
