"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ScanForm";
import { Select } from "@/components/Select";
import type { ControlMode } from "@/lib/flows/settings";
import { saveControl } from "./company-actions";

const MODES = [
  { value: "packing", label: "En empaque" },
  { value: "all", label: "Todos los pedidos" },
  { value: "large", label: "Pedidos grandes" },
];
const SAME_PERSON = [
  { value: "yes", label: "Cualquiera" },
  { value: "no", label: "Otra persona" },
];

export function ControlSettings({ mode: initial, minUnits, samePerson }: { mode: ControlMode; minUnits: number | null; samePerson: boolean }) {
  const [mode, setMode] = useState<string>(initial);
  return (
    <ActionForm action={saveControl} button="Guardar" className="max-w-sm space-y-4" resetOnOk={false}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="mode" className="field-label">
            Paso de control
          </label>
          <Select id="mode" name="mode" value={mode} onChange={setMode} options={MODES} required />
        </div>
        {mode === "large" && (
          <div>
            <label htmlFor="minUnits" className="field-label">
              Desde (unidades)
            </label>
            <input id="minUnits" name="minUnits" type="number" inputMode="numeric" min={2} step={1} required defaultValue={minUnits && minUnits > 1 ? minUnits : 50} className="field w-28" />
          </div>
        )}
      </div>
      <div>
        <label htmlFor="samePerson" className="field-label">
          Quién controla
        </label>
        <Select id="samePerson" name="samePerson" defaultValue={samePerson ? "yes" : "no"} options={SAME_PERSON} required />
      </div>
    </ActionForm>
  );
}
