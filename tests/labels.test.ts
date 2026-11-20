import { describe, expect, it } from "vitest";
import { KIND_ORDER, LABEL_KINDS, layout, type LabelData } from "@/lib/labels/kinds";
import { LEADING, wrap } from "@/lib/labels/model";
import { SIZES, sizeById } from "@/lib/labels/sizes";
import { toTspl, tsplBytes } from "@/lib/labels/tspl";
import { toZpl, zplText } from "@/lib/labels/zpl";

const SAMPLE: Record<string, LabelData> = {
  item: { kind: "item", data: { name: "CRÓNICAS DE LA LUNA ROJA VOL. 3 EDICIÓN ESPECIAL CON ÑANDÚES", code: "9789500700016", sku: "OVN-0123" } },
  location: { kind: "location", data: { code: "A-01-1" } },
  box: { kind: "box", data: { order: "PED-00012", box: 2, boxes: 3, customer: "Librería El Ateneo de la Patagonia Sur", address: "Av. Santa Fe 1860, piso 3", city: "Ciudad Autónoma de Buenos Aires, Buenos Aires", carrier: "Andreani", remito: "R-0001-00012345", tracking: "36000291452001", kilos: "4,2", company: "Ovnipress" } },
  condition: { kind: "condition", data: { grade: "DAÑADO", name: "BATMAN AÑO UNO", code: "OVN-0456", document: "DEV-0003" } },
  test: { kind: "test", data: { size: "50 × 25 mm", printer: "Zebra ZD421 (demo) · ZPL 203 dpi" } },
};

describe("label layouts", () => {
  it("keep every element inside the label, for every kind at every size it allows", () => {
    for (const kind of KIND_ORDER) {
      for (const size of SIZES.filter((s) => LABEL_KINDS[kind].fits(s))) {
        const doc = layout(SAMPLE[kind], size);
        for (const el of doc.els) {
          const h = el.t === "text" ? el.lines.length * el.size * LEADING : el.h;
          const where = `${kind} ${size.id} ${el.t} ${el.t === "text" ? el.lines.join("|") : ""}`;
          expect(el.x, where).toBeGreaterThanOrEqual(0);
          expect(el.y, where).toBeGreaterThanOrEqual(0);
          expect(el.x + el.w, where).toBeLessThanOrEqual(size.w + 0.01);
          expect(el.y + h, where).toBeLessThanOrEqual(size.h + 0.01);
        }
        expect(doc.els.some((e) => e.t === "barcode") || kind === "test", `${kind} ${size.id} has a barcode`).toBe(true);
      }
    }
  });
  it("each kind's default size is one it allows", () => {
    for (const kind of KIND_ORDER) expect(LABEL_KINDS[kind].fits(sizeById(LABEL_KINDS[kind].defaultSize)!), kind).toBe(true);
  });
  it("wraps text and marks what was cut", () => {
    expect(wrap("UNO DOS TRES", 100, 3, 2)).toEqual(["UNO DOS TRES"]);
    const cut = wrap("PALABRA ".repeat(20), 20, 3, 2);
    expect(cut).toHaveLength(2);
    expect(cut[1].endsWith("…")).toBe(true);
  });
});

describe("printer languages", () => {
  const doc = layout(SAMPLE.item, sizeById("50x25")!);
  it("ZPL: size in dots, UTF-8, the barcode, copies", () => {
    const z = toZpl(doc, 203, 3);
    expect(z).toMatch(/^\^XA\n\^CI28\n\^PW400\n\^LL200/);
    expect(z).toContain("^BEN,");
    expect(z).toContain("^FD978950070001^FS");
    expect(z).toContain("^PQ3\n^XZ");
    expect(toZpl(doc, 300)).toContain("^PW591");
    expect(zplText("ÑANDÚ ^~_")).toBe("_C3_91AND_C3_9A _5E_7E_5F");
  });
  it("TSPL: size in mm, code page 1252, the barcode, copies", () => {
    const t = toTspl(doc, 203, 2);
    expect(t.split("\r\n").slice(0, 6)).toEqual(["SIZE 50 mm,25 mm", "GAP 2 mm,0 mm", "DIRECTION 1", "REFERENCE 0,0", "CODEPAGE 1252", "CLS"]);
    expect(t).toMatch(/BARCODE \d+,\d+,"EAN13",\d+,0,0,\d,\d,"978950070001"/);
    expect(t.endsWith("PRINT 2,1")).toBe(true);
    expect([...tsplBytes("Ñ€")]).toEqual([0xd1, 0x80]);
  });
  it("Code 128 for internal codes", () => {
    const loc = layout(SAMPLE.location, sizeById("100x50")!);
    expect(toZpl(loc)).toContain("^BCN,");
    expect(toTspl(loc)).toContain('"128"');
  });
});
