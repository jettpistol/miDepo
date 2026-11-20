"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/** A code chip with its copy button. */
export function CodeWithCopy({ value, what }: { value: string; what: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="code-chip">{value}</span>
      <CopyButton value={value} what={what} />
    </span>
  );
}

/** Small button that copies a code (SKU, ISBN) to the clipboard and says so for a moment. */
export function CopyButton({ value, what }: { value: string; what: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className={`btn-copy ${copied ? "text-ok!" : ""}`}
      aria-label={copied ? `${what} copiado` : `Copiar ${what}`}
      title={copied ? "Copiado" : `Copiar ${what}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Without clipboard permission the code stays selectable by hand.
        }
      }}
    >
      <Icon name={copied ? "ok" : "copy"} className="size-3.5" />
    </button>
  );
}
