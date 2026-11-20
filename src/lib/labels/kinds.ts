import { LEADING, symbologyFor, text, textHeight, type El, type LabelDoc } from "./model";
import type { LabelSize } from "./sizes";

/**
 * The labels miDepo prints and how each is laid out at any size. Layouts work in millimetres
 * from the label's own width and height, so every size in sizes.ts gets a sensible label.
 */

export type ItemData = { name: string; code: string; sku: string | null };
export type LocationData = { code: string; note?: string | null };
export type BoxData = {
  order: string;
  box: number;
  boxes: number;
  customer: string;
  address: string | null;
  city: string | null;
  carrier: string | null;
  remito: string | null;
  tracking: string | null;
  kilos: string | null;
  company: string;
};
export type ConditionData = { grade: string; name: string; code: string; document: string };
export type TestData = { size: string; printer: string };

export type LabelData =
  | { kind: "item"; data: ItemData }
  | { kind: "location"; data: LocationData }
  | { kind: "box"; data: BoxData }
  | { kind: "condition"; data: ConditionData }
  | { kind: "test"; data: TestData };
export type LabelKind = LabelData["kind"];
/** A label with how many copies of it: what a label job stores. */
export type StoredLabel = LabelData & { copies: number };

type KindInfo = { name: string; defaultSize: string; fits: (s: LabelSize) => boolean };

export const LABEL_KINDS: Record<LabelKind, KindInfo> = {
  item: { name: "Artículo", defaultSize: "50x25", fits: (s) => s.w >= 30 && s.h >= 15 && s.h <= 110 },
  location: { name: "Ubicación", defaultSize: "100x50", fits: (s) => s.w >= 38 && s.h >= 20 },
  box: { name: "Caja", defaultSize: "100x150", fits: (s) => s.w >= 75 && s.h >= 50 },
  condition: { name: "Devolución", defaultSize: "50x25", fits: (s) => s.w >= 38 && s.h >= 20 && s.h <= 110 },
  test: { name: "Prueba", defaultSize: "50x25", fits: () => true },
};

export const KIND_ORDER: LabelKind[] = ["item", "location", "box", "condition", "test"];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const margin = (w: number, h: number) => clamp(Math.min(w, h) * 0.07, 1.5, 4);

/** A barcode with its value printed underneath, filling the space from y to bottom. */
function barcodeWithText(els: El[], x: number, y: number, w: number, bottom: number, value: string, caption: string, captionSize: number) {
  const hr = text(x, bottom - captionSize * LEADING, w, captionSize, caption, { align: "center", mono: true, bold: true });
  const bh = Math.max(4, hr.y - 0.6 - y);
  els.push({ t: "barcode", x, y, w, h: bh, value, symbology: symbologyFor(value) }, hr);
}

function item(d: ItemData, w: number, h: number): El[] {
  const m = margin(w, h);
  const iw = w - 2 * m;
  const els: El[] = [];
  let y = m;
  if (h >= 22) {
    const title = text(m, y, iw, clamp(h * 0.1, 2, 4.2), d.name, { lines: h >= 30 ? 2 : 1, bold: true });
    els.push(title);
    y += textHeight(title) + m * 0.4;
  }
  const caption = d.sku && d.sku !== d.code ? `${d.sku} · ${d.code}` : d.code;
  barcodeWithText(els, m, y, iw, h - m, d.code, caption, clamp(h * 0.085, 1.8, 3));
  return els;
}

function location(d: LocationData, w: number, h: number): El[] {
  const m = margin(w, h);
  const iw = w - 2 * m;
  const size = clamp(iw / (Math.max(4, d.code.length) * 0.62), 3, h * 0.34);
  const code = text(m, m, iw, size, d.code, { bold: true, align: "center" });
  const els: El[] = [code];
  let bottom = h - m;
  if (d.note && h >= 30) {
    const note = text(m, bottom - 2.4 * LEADING, iw, 2.4, d.note, { align: "center" });
    els.push(note);
    bottom = note.y - 0.6;
  }
  els.push({ t: "barcode", x: m, y: m + textHeight(code) + 0.8, w: iw, h: Math.max(4, bottom - (m + textHeight(code) + 0.8)), value: d.code, symbology: "code128" });
  return els;
}

const caps = (x: number, y: number, w: number, value: string) => text(x, y, w, 2.2, value.toUpperCase(), { bold: true });

function box(d: BoxData, w: number, h: number): El[] {
  const m = margin(w, h);
  const iw = w - 2 * m;
  const code = `${d.order}-C${d.box}`;
  const els: El[] = [];
  if (h < 100) {
    // Compact: order, box n of N, customer, box code.
    const top = text(m, m, iw * 0.55, clamp(h * 0.09, 3, 5), d.order, { bold: true, mono: true });
    const n = text(m + iw * 0.55, m, iw * 0.45, clamp(h * 0.12, 3.5, 7), `${d.box} de ${d.boxes}`, { bold: true, align: "right" });
    const who = text(m, m + textHeight(n) + 0.5, iw, clamp(h * 0.075, 2.5, 4), d.customer, { bold: true });
    els.push(top, n, who);
    barcodeWithText(els, m, who.y + textHeight(who) + 1, iw, h - m, code, code, 2.4);
    return els;
  }
  let y = m;
  const push = (el: El & { t: "text" }, gap = 0.6) => {
    els.push(el);
    y = el.y + textHeight(el) + gap;
  };
  push(caps(m, y, iw, "Destinatario"), 0.6);
  push(text(m, y, iw, 5, d.customer, { lines: 2, bold: true }), 1);
  if (d.address) push(text(m, y, iw, 3.6, d.address, { lines: 2 }), 0.2);
  if (d.city) push(text(m, y, iw, 3.6, d.city), 1.5);
  els.push({ t: "bar", x: m, y, w: iw, h: 0.5 });
  y += 2;
  const half = iw / 2 - 1.5;
  els.push(caps(m, y, half, "Transporte"), caps(m + iw / 2 + 1.5, y, half, "Remito"));
  y += 2.2 * LEADING + 0.4;
  els.push(text(m, y, half, 3.6, d.carrier ?? "—", { bold: true }), text(m + iw / 2 + 1.5, y, half, 3.6, d.remito ?? "—", { bold: true, mono: true }));
  y += 3.6 * LEADING + 1.5;
  if (d.tracking) {
    push(caps(m, y, iw, "Seguimiento"), 0.6);
    els.push({ t: "barcode", x: m, y, w: iw * 0.8, h: 11, value: d.tracking, symbology: "code128" });
    y += 11.6;
    push(text(m, y, iw, 3, d.tracking, { mono: true }), 1.5);
  }
  els.push({ t: "bar", x: m, y, w: iw, h: 0.5 });
  // The bottom block, from the bottom edge up: box number on the left, box code on the right.
  const bottom = h - m;
  const right = m + iw * 0.48;
  const rw = iw * 0.52;
  const codeText = text(right, bottom - 3 * LEADING, rw, 3, `${code} · ${d.company}`, { bold: true, mono: true, align: "right" });
  els.push(codeText, { t: "barcode", x: right, y: codeText.y - 15, w: rw, h: 14, value: code, symbology: "code128" });
  const kg = d.kilos ? text(m, bottom - 3.6 * LEADING, iw * 0.45, 3.6, `${d.kilos} kg`) : null;
  const nY = (kg ? kg.y : bottom) - 10 * LEADING;
  els.push(caps(m, nY - 2.8, iw * 0.45, "Caja"), text(m, nY, iw * 0.45, 10, `${d.box} de ${d.boxes}`, { bold: true }));
  if (kg) els.push(kg);
  return els;
}

function condition(d: ConditionData, w: number, h: number): El[] {
  const m = margin(w, h);
  const iw = w - 2 * m;
  const grade = text(m, m, iw, clamp(iw / (d.grade.length * 0.62), 3, h * 0.26), d.grade, { bold: true, align: "center" });
  const name = text(m, m + textHeight(grade), iw, clamp(h * 0.08, 1.8, 3.4), d.name, { align: "center" });
  const els: El[] = [grade, name];
  barcodeWithText(els, m, name.y + textHeight(name) + 0.6, iw, h - m, d.code, `${d.document} · ${d.code}`, clamp(h * 0.075, 1.8, 2.8));
  return els;
}

function test(d: TestData, w: number, h: number): El[] {
  const m = margin(w, h);
  const iw = w - 2 * m;
  const els: El[] = [{ t: "box", x: 0.5, y: 0.5, w: w - 1, h: h - 1, line: 0.3 }];
  const size = clamp(h * 0.09, 1.8, 4);
  const title = text(m, m, iw, size, `PRUEBA ${d.size}`, { bold: true });
  const who = text(m, m + textHeight(title), iw, size * 0.8, d.printer);
  const accents = text(m, who.y + textHeight(who), iw, size * 0.8, "ÁÉÍÓÚ Ñ Ü áéíóú ñ ü");
  els.push(title, who, accents);
  let y = accents.y + textHeight(accents) + 0.8;
  // Ruler: a printed 10 mm must measure 10 mm. Ticks every 5 mm.
  const length = Math.min(50, Math.floor((iw - 9) / 10) * 10);
  if (length >= 10 && h - m - y > 10) {
    els.push({ t: "bar", x: m, y: y + 2.5, w: length, h: 0.3 });
    for (let x = 0; x <= length; x += 5) els.push({ t: "bar", x: m + x - 0.15, y: x % 10 === 0 ? y : y + 1.2, w: 0.3, h: x % 10 === 0 ? 2.8 : 1.6 });
    els.push(text(m + length + 1, y + 0.6, iw - length - 1, 2, `${length} mm`));
    y += 4;
  }
  if (h - m - y >= 5) barcodeWithText(els, m, y, iw, h - m, "MIDEPO-TEST", "MIDEPO-TEST", clamp(h * 0.07, 1.6, 2.6));
  return els;
}

export function layout(l: LabelData, s: LabelSize): LabelDoc {
  const { w, h } = s;
  const els =
    l.kind === "item" ? item(l.data, w, h) : l.kind === "location" ? location(l.data, w, h) : l.kind === "box" ? box(l.data, w, h) : l.kind === "condition" ? condition(l.data, w, h) : test(l.data, w, h);
  return { w, h, els };
}
