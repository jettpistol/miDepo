import { LEADING, modules, type LabelDoc } from "./model";
import { barFit } from "./zpl";

/**
 * TSPL / TSPL2 (TSC, and most Chinese label printers: Xprinter, HPRT, iDPRT, Munbyn…). Built-in
 * bitmap fonts 1–5 only, which every clone has, and code page 1252: the transport encodes the
 * text as Windows-1252 bytes. Syntax from the TSPL2 manual; not yet checked on a printer.
 */

/** Built-in fonts: name, width and height in dots (the same at any resolution). */
const FONTS = [
  { name: "1", w: 8, h: 12 },
  { name: "2", w: 12, h: 20 },
  { name: "3", w: 16, h: 24 },
  { name: "4", w: 24, h: 32 },
  { name: "5", w: 32, h: 48 },
];

const dots = (dpi: number) => (mm: number) => Math.max(0, Math.round((mm * dpi) / 25.4));

/** The largest font no taller than h dots (font 5 enlarged above 48). */
function font(h: number) {
  const f = [...FONTS].reverse().find((x) => x.h <= h) ?? FONTS[0];
  const mul = f.name === "5" ? Math.max(1, Math.floor(h / f.h)) : 1;
  return { ...f, mul };
}

const quote = (s: string) => s.replace(/"/g, '\\["]');

export function toTspl(doc: LabelDoc, dpi = 203, copies = 1) {
  const D = dots(dpi);
  const out = [`SIZE ${doc.w} mm,${doc.h} mm`, "GAP 2 mm,0 mm", "DIRECTION 1", "REFERENCE 0,0", "CODEPAGE 1252", "CLS"];
  for (const el of doc.els) {
    if (el.t === "text") {
      const f = font(D(el.size));
      const charW = f.w * f.mul;
      const max = Math.max(1, Math.floor(D(el.w) / charW));
      el.lines.forEach((raw, i) => {
        const line = raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
        const width = line.length * charW;
        const x = D(el.x) + (el.align === "center" ? Math.floor((D(el.w) - width) / 2) : el.align === "right" ? D(el.w) - width : 0);
        out.push(`TEXT ${Math.max(0, x)},${D(el.y + i * el.size * LEADING)},"${f.name}",0,${f.mul},${f.mul},"${quote(line)}"`);
      });
    } else if (el.t === "bar") {
      out.push(`BAR ${D(el.x)},${D(el.y)},${Math.max(1, D(el.w))},${Math.max(1, D(el.h))}`);
    } else if (el.t === "box") {
      out.push(`BOX ${D(el.x)},${D(el.y)},${D(el.x + el.w)},${D(el.y + el.h)},${Math.max(1, D(el.line))}`);
    } else {
      const ean = el.symbology === "ean13";
      const { mod, left } = barFit(D(el.x), D(el.w), modules(el.value, el.symbology), ean ? 9 : 10, Math.max(2, Math.round(dpi / 100)));
      out.push(`BARCODE ${left},${D(el.y)},"${ean ? "EAN13" : "128"}",${D(el.h)},0,0,${mod},${mod},"${quote(ean ? el.value.slice(0, 12) : el.value)}"`);
    }
  }
  out.push(`PRINT ${Math.max(1, copies)},1`);
  return out.join("\r\n");
}

/** TSPL text as the bytes a printer set to code page 1252 expects; characters outside it become "?". */
export function tsplBytes(program: string) {
  const extra: Record<string, number> = { "€": 0x80, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97 };
  const out = new Uint8Array(program.length * 2);
  let n = 0;
  for (const ch of program) {
    const c = ch.codePointAt(0)!;
    out[n++] = c < 256 ? c : (extra[ch] ?? 0x3f);
  }
  return out.slice(0, n);
}
