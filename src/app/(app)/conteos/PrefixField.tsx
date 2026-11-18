"use client";

import { useEffect, useRef, useState } from "react";
import { Note } from "@/components/ScanForm";
import type { Lookup, FieldStatus } from "@/lib/lookup";

/** The "locations starting with" field: says how many there are before the count is created. */
export function PrefixField() {
  const [status, setStatus] = useState<FieldStatus>();
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // If it is not going to work, the browser says so when you try to submit.
  useEffect(() => field.current?.setCustomValidity(status?.tone === "danger" ? status.text : ""), [status]);

  return (
    <div>
      <label htmlFor="prefix" className="field-label">
        Ubicaciones que empiezan con
      </label>
      <input
        ref={field}
        id="prefix"
        name="prefix"
        className={`field font-mono font-bold placeholder:font-normal ${status?.tone === "danger" ? "border-danger" : ""}`}
        placeholder="A-01"
        autoCapitalize="characters"
        autoComplete="off"
        aria-describedby="note-prefix"
        required
        onChange={(e) => {
          const q = e.target.value.trim();
          setStatus(undefined);
          clearTimeout(timer.current);
          if (!q) return;
          timer.current = setTimeout(async () => {
            try {
              const r = await fetch(`/api/lookup?ctx=new-count&prefix=${encodeURIComponent(q)}`);
              if (r.ok && field.current?.value.trim() === q) setStatus(((await r.json()) as Lookup).statuses.prefix);
            } catch {
              /* sin red, la acción valida igual */
            }
          }, 200);
        }}
      />
      <Note id="note-prefix" status={status} />
    </div>
  );
}
