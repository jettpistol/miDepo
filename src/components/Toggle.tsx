"use client";

import { useId, useState, type ReactNode } from "react";
import { InfoHint } from "./Hint";

/** On/off for one setting: a switch beside its label. Sends `name` as "yes" or "no" in a form. */
export function Toggle({ name, label, hint, defaultChecked = false }: { name: string; label: string; hint?: ReactNode; defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 lg:min-h-8">
      <span className="flex items-center gap-1">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <InfoHint text={hint} />}
      </span>
      <input type="hidden" name={name} value={on ? "yes" : "no"} />
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 ${on ? "border-accent bg-accent" : "border-line-strong bg-sunken"}`}
      >
        <span aria-hidden="true" className={`size-3.5 rounded-full shadow-sm transition-transform duration-150 ${on ? "translate-x-[18px] bg-on-accent" : "translate-x-[2px] bg-surface"}`} />
      </button>
    </div>
  );
}
