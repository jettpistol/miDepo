"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { assignAction } from "@/app/(app)/actions";
import type { AssignKind } from "@/lib/flows/assignments";
import { Message } from "./ScanForm";
import { Select, type Option } from "./Select";

/** "Asignado a" for supervisors: picking a person saves at once, no extra button. */
export function AssignSelect({ kind, id, value, people }: { kind: AssignKind; id: number; value: number | null; people: Option[] }) {
  const [status, submit, saving] = useActionState(assignAction, {});
  const [chosen, setChosen] = useState(value == null ? "" : String(value));
  const form = useRef<HTMLFormElement>(null);
  const saved = useRef(chosen);
  // Sends once the hidden field holds the new choice.
  useEffect(() => {
    if (chosen !== saved.current) {
      saved.current = chosen;
      form.current?.requestSubmit();
    }
  }, [chosen]);
  return (
    <form ref={form} action={submit} className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <span className="text-sm text-muted">Asignado a</span>
      <Select name="userId" label="Asignado a" value={chosen} onChange={setChosen} options={[{ value: "", label: "Sin asignar" }, ...people]} searchPlaceholder="Buscar persona…" className="min-w-44" />
      {saving && <span className="text-sm text-muted">Guardando…</span>}
      <Message status={status} />
    </form>
  );
}
