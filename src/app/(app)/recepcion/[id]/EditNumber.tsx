"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import type { Action } from "@/components/ScanForm";

/** An editable number in a table: saved on blur or with Enter. */
export function EditNumber({ action, hiddenFields, field, value }: { action: Action; hiddenFields: Record<string, string | number>; field: string; value: number }) {
  const [status, submit, submitting] = useActionState(action, {});
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  function save() {
    if (text === String(value) || text === "") return setText(String(value));
    const data = new FormData();
    Object.entries(hiddenFields).forEach(([k, v]) => data.set(k, String(v)));
    data.set(field, text);
    startTransition(() => submit(data));
  }

  return (
    <span className="inline-flex flex-col items-end">
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={text}
        disabled={submitting}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label="Corregir cantidad"
        className="field min-h-10 w-20 px-2 py-1 text-right font-bold lg:min-h-9"
      />
      {status.error && <span className="mt-1 text-xs text-danger">{status.error}</span>}
    </span>
  );
}
