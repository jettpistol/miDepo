"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ScanForm";
import { Select } from "@/components/Select";
import type { ControlMode } from "@/lib/flows/settings";
import { saveControl } from "./actions";

const MODES = [
  { value: "packing", label: "En el empaque", detail: "Quien empaca escanea cada unidad de nuevo." },
  { value: "all", label: "Paso de control, todos los pedidos", detail: "Antes de empacar, en la pantalla Control." },
  { value: "large", label: "Paso de control, pedidos grandes", detail: "Los demás se controlan en el empaque." },
];
const SAME_PERSON = [
  { value: "yes", label: "Puede ser quien preparó" },
  { value: "no", label: "Siempre otra persona" },
];

export function ControlSettings({ mode: initial, minUnits, samePerson }: { mode: ControlMode; minUnits: number | null; samePerson: boolean }) {
  const [mode, setMode] = useState<string>(initial);
  return (
    <ActionForm action={saveControl} button="Guardar control" className="max-w-md space-y-4" resetOnOk={false}>
      <div>
        <label htmlFor="mode" className="field-label">
          Dónde se controla lo preparado
        </label>
        <Select id="mode" name="mode" value={mode} onChange={setMode} options={MODES} required />
      </div>
      {mode === "large" && (
        <div>
          <label htmlFor="minUnits" className="field-label">
            Pedidos desde cuántas unidades
          </label>
          <input id="minUnits" name="minUnits" type="number" inputMode="numeric" min={2} step={1} required defaultValue={minUnits && minUnits > 1 ? minUnits : 50} className="field w-32" />
        </div>
      )}
      <div>
        <label htmlFor="samePerson" className="field-label">
          Quién controla
        </label>
        <Select id="samePerson" name="samePerson" defaultValue={samePerson ? "yes" : "no"} options={SAME_PERSON} required />
      </div>
    </ActionForm>
  );
}
