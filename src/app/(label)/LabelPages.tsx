import bwipjs from "bwip-js/node";
import { layout, type StoredLabel } from "@/lib/labels/kinds";
import { LEADING, modules, type El, type LabelDoc } from "@/lib/labels/model";
import { A4, perSheet, sheetLeft, type LabelSize } from "@/lib/labels/sizes";

/**
 * Labels as pages for the system print dialog, drawn from the same layout as ZPL and TSPL.
 * A roll size prints one label per page of exactly that size; an A4 size fills sheets.
 */

/** Widest bar that still reads well: 3 dots at 203 dpi. */
const MAX_MODULE_MM = 0.375;

function barcodeSvg(el: Extract<El, { t: "barcode" }>) {
  try {
    const svg = bwipjs.toSVG({ bcid: el.symbology === "ean13" ? "ean13" : "code128", text: el.value, height: 10, includetext: false, paddingwidth: 0, paddingheight: 0 });
    // Stretch the root to its box: bars only get taller or wider, never distorted in a way scanners mind.
    return svg.replace(/^<svg /, '<svg width="100%" height="100%" preserveAspectRatio="none" style="display:block" ');
  } catch {
    return "";
  }
}

function Element({ el }: { el: El }) {
  const mm = (n: number) => `${n}mm`;
  if (el.t === "text") {
    return (
      <>
        {el.lines.map((line, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: mm(el.x),
              top: mm(el.y + i * el.size * LEADING),
              width: mm(el.w),
              fontSize: mm(el.size),
              lineHeight: LEADING,
              fontWeight: el.bold ? 700 : 400,
              textAlign: el.align ?? "left",
              fontFamily: el.mono ? "ui-monospace, 'Courier New', monospace" : "Arial, Helvetica, sans-serif",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {line}
          </div>
        ))}
      </>
    );
  }
  if (el.t === "bar") return <div style={{ position: "absolute", left: mm(el.x), top: mm(el.y), width: mm(el.w), height: mm(el.h), background: "#000" }} />;
  if (el.t === "box") return <div style={{ position: "absolute", left: mm(el.x), top: mm(el.y), width: mm(el.w), height: mm(el.h), border: `${el.line}mm solid #000`, boxSizing: "border-box" }} />;
  const count = modules(el.value, el.symbology);
  const quiet = el.symbology === "ean13" ? 18 : 20;
  const mod = Math.min(MAX_MODULE_MM, el.w / count);
  const width = (count - quiet) * mod;
  return <div style={{ position: "absolute", left: mm(el.x + (el.w - width) / 2), top: mm(el.y), width: mm(width), height: mm(el.h) }} dangerouslySetInnerHTML={{ __html: barcodeSvg(el) }} />;
}

export function Label({ doc, outline = false }: { doc: LabelDoc; outline?: boolean }) {
  return (
    <div style={{ position: "relative", width: `${doc.w}mm`, height: `${doc.h}mm`, overflow: "hidden", background: "#fff", color: "#000" }} className={outline ? "outline outline-1 outline-neutral-300 print:outline-0" : undefined}>
      {doc.els.map((el, i) => (
        <Element key={i} el={el} />
      ))}
    </div>
  );
}

/** Every label (copies included) as print pages at the size. */
export function LabelPages({ labels, size }: { labels: StoredLabel[]; size: LabelSize }) {
  const docs = labels.flatMap((l) => {
    const doc = layout(l, size);
    return Array.from({ length: Math.max(1, l.copies) }, () => doc);
  });
  if (!size.sheet) {
    return (
      <>
        <style>{`@page { size: ${size.w}mm ${size.h}mm; margin: 0; }`}</style>
        <div className="flex flex-col items-center gap-[4mm] print:block">
          {docs.map((doc, i) => (
            <div key={i} className="break-after-page shadow-sm print:shadow-none">
              <Label doc={doc} outline />
            </div>
          ))}
        </div>
      </>
    );
  }
  const n = perSheet(size);
  const sheets = Array.from({ length: Math.ceil(docs.length / n) }, (_, i) => docs.slice(i * n, (i + 1) * n));
  const { across, top, pitchX, pitchY } = size.sheet;
  const left = sheetLeft(size);
  return (
    <>
      <style>{`@page { size: A4; margin: 0; }`}</style>
      <div className="flex flex-col items-center gap-[6mm] print:block">
        {sheets.map((sheet, s) => (
          <div key={s} className="relative break-after-page bg-white shadow-sm print:shadow-none" style={{ width: `${A4.w}mm`, height: `${A4.h}mm` }}>
            {sheet.map((doc, i) => (
              <div key={i} className="absolute" style={{ left: `${left + (i % across) * pitchX}mm`, top: `${top + Math.floor(i / across) * pitchY}mm` }}>
                <Label doc={doc} outline />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
