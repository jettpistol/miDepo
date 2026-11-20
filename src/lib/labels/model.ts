/**
 * A label laid out in millimetres: what every renderer (HTML for the print dialog, ZPL, TSPL)
 * draws the same way. Text is already split into lines and cut to fit, so the HTML preview and
 * a thermal printer show the same words.
 */

export type Symbology = "code128" | "ean13";

export type TextEl = { t: "text"; x: number; y: number; w: number; size: number; lines: string[]; bold?: boolean; align?: "left" | "center" | "right"; mono?: boolean };
export type BarcodeEl = { t: "barcode"; x: number; y: number; w: number; h: number; value: string; symbology: Symbology };
/** A filled rectangle: rules, ruler ticks, a black band. */
export type BarEl = { t: "bar"; x: number; y: number; w: number; h: number };
/** An outline. */
export type BoxEl = { t: "box"; x: number; y: number; w: number; h: number; line: number };
export type El = TextEl | BarcodeEl | BarEl | BoxEl;

export type LabelDoc = { w: number; h: number; els: El[] };

/** Line height as a multiple of the font size. */
export const LEADING = 1.18;

/** Average width of a character, as a share of the font size (bold sans, mostly capitals). */
const CHAR = 0.62;
const MONO = 0.6;

export const fitsChars = (widthMm: number, sizeMm: number, mono = false) => Math.max(1, Math.floor(widthMm / (sizeMm * (mono ? MONO : CHAR))));

/** Splits text into at most `maxLines` lines of the width; the last one ends in "…" if text is left over. */
export function wrap(text: string, widthMm: number, sizeMm: number, maxLines: number, mono = false) {
  const max = fitsChars(widthMm, sizeMm, mono);
  const words = text.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let cut = false;
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= max) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    if (lines.length === maxLines) {
      cut = true;
      break;
    }
    if (w.length > max) cut = true;
    line = w.slice(0, max);
  }
  if (line) {
    if (lines.length < maxLines) lines.push(line);
    else cut = true;
  }
  if (cut && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${last.length >= max ? last.slice(0, max - 1) : last}…`;
  }
  return lines;
}

/** The largest font size (mm) at which text fits on one line of the width, between min and max. */
export function fitSize(text: string, widthMm: number, min: number, max: number, mono = false) {
  const size = widthMm / (Math.max(1, text.length) * (mono ? MONO : CHAR));
  return Math.max(min, Math.min(max, size));
}

export const text = (x: number, y: number, w: number, size: number, value: string, o: { lines?: number; bold?: boolean; align?: TextEl["align"]; mono?: boolean } = {}): TextEl => ({
  t: "text",
  x,
  y,
  w,
  size,
  lines: wrap(value, w, size, o.lines ?? 1, o.mono),
  bold: o.bold,
  align: o.align,
  mono: o.mono,
});

/** Height a text element takes. */
export const textHeight = (el: TextEl) => el.lines.length * el.size * LEADING;

/** EAN-13 when the code is one (check digit included), else Code 128. */
export const symbologyFor = (code: string): Symbology => (/^\d{13}$/.test(code) && eanValid(code) ? "ean13" : "code128");

function eanValid(s: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}

/**
 * Narrowest bar (module) count of a barcode, quiet zones included: what decides the bar width
 * a printer can use. Code 128 uses subset C (two digits per symbol) for runs of digits.
 */
export function modules(value: string, symbology: Symbology) {
  if (symbology === "ean13") return 95 + 18;
  const symbols = /^\d+$/.test(value) && value.length % 2 === 0 ? value.length / 2 : value.length;
  return (symbols + 3) * 11 + 2 + 20;
}
