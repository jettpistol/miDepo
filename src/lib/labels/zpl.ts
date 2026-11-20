import { LEADING, modules, type LabelDoc } from "./model";

/**
 * ZPL II (Zebra, and the ZPL emulation of TSC, Honeywell, Godex, SATO, Citizen and most 4-inch
 * clones). Only the commands every emulator documents: ^FO ^A0 ^FB ^FH ^GB ^BY ^BC ^BE ^PQ.
 * Text is UTF-8 (^CI28), written as hex escapes (^FH) so any accent survives the cable.
 */

const dots = (dpi: number) => (mm: number) => Math.max(0, Math.round((mm * dpi) / 25.4));

/** UTF-8 bytes of anything outside plain ASCII, and of ^ ~ _, as _XX for ^FH. */
export function zplText(s: string) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 32 && c < 127 && ch !== "^" && ch !== "~" && ch !== "_") out += ch;
    else for (const b of new TextEncoder().encode(ch)) out += `_${b.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

/** Bar width in dots and left edge of the bars, so the symbol (quiet zones included) is centred in w. */
export function barFit(x: number, w: number, count: number, quiet: number, maxModule: number) {
  const mod = Math.max(1, Math.min(maxModule, Math.floor(w / count)));
  return { mod, left: x + Math.floor((w - mod * count) / 2) + quiet * mod };
}

export function toZpl(doc: LabelDoc, dpi = 203, copies = 1) {
  const D = dots(dpi);
  const out = ["^XA", "^CI28", `^PW${D(doc.w)}`, `^LL${D(doc.h)}`, "^LH0,0"];
  for (const el of doc.els) {
    if (el.t === "text") {
      const h = Math.max(10, D(el.size));
      el.lines.forEach((line, i) => {
        const y = D(el.y + i * el.size * LEADING);
        const block = el.align && el.align !== "left" ? `^FB${D(el.w)},1,0,${el.align === "center" ? "C" : "R"},0` : "";
        out.push(`^FO${D(el.x)},${y}^A0N,${h},${h}${block}^FH^FD${zplText(line)}^FS`);
      });
    } else if (el.t === "bar") {
      const w = Math.max(1, D(el.w));
      const h = Math.max(1, D(el.h));
      out.push(`^FO${D(el.x)},${D(el.y)}^GB${w},${h},${Math.min(w, h)}^FS`);
    } else if (el.t === "box") {
      out.push(`^FO${D(el.x)},${D(el.y)}^GB${D(el.w)},${D(el.h)},${Math.max(1, D(el.line))}^FS`);
    } else {
      const ean = el.symbology === "ean13";
      const { mod, left } = barFit(D(el.x), D(el.w), modules(el.value, el.symbology), ean ? 9 : 10, Math.max(2, Math.round(dpi / 100)));
      const command = ean ? `^BEN,${D(el.h)},N,N^FD${el.value.slice(0, 12)}` : `^BCN,${D(el.h)},N,N,N,A^FD${zplText(el.value)}`;
      out.push(`^FO${left},${D(el.y)}^BY${mod}${command.startsWith("^BC") ? command.replace("^FD", "^FH^FD") : command}^FS`);
    }
  }
  out.push(`^PQ${Math.max(1, copies)}`, "^XZ");
  return out.join("\n");
}
