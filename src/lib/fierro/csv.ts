/** Files to load into Fierro while there is no direct connection. */

const cell = (v: string | number | null | undefined) => {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function csv(rows: (string | number | null | undefined)[][], header?: string[]) {
  const all = header ? [header, ...rows] : rows;
  // BOM so Excel opens accented characters correctly.
  return "﻿" + all.map((f) => f.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Fierro accepts a single kind of code per file: we use the ISBN and, failing that, the internal code. */
export const fierroCode = (p: { isbn: string | null; internalCode: string }) => p.isbn ?? p.internalCode;
