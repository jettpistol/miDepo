"use client";

import { Icon } from "@/components/Icon";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-control bg-on-accent px-4 py-1.5 text-sm font-semibold text-accent transition-colors duration-150 hover:bg-on-accent/88 focus-visible:outline-on-accent!">
      <Icon name="print" className="size-4.5" />
      Imprimir
    </button>
  );
}
