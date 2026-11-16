/** Archivos para cargar en Fierro mientras no haya conexión directa. */

const celda = (v: string | number | null | undefined) => {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function csv(filas: (string | number | null | undefined)[][], encabezado?: string[]) {
  const todas = encabezado ? [encabezado, ...filas] : filas;
  // BOM para que Excel abra bien los acentos.
  return "﻿" + todas.map((f) => f.map(celda).join(",")).join("\r\n") + "\r\n";
}

/** Fierro acepta un solo tipo de código por archivo: usamos ISBN y, si no hay, el código interno. */
export const codigoFierro = (p: { isbn: string | null; codigoInterno: string }) => p.isbn ?? p.codigoInterno;
