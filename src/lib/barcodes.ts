import bwipjs from "bwip-js/node";

/** Code 128 barcode as SVG. USB scanners and the phone camera both read it. */
export function barcodes(text: string, barHeight = 12) {
  return bwipjs.toSVG({ bcid: "code128", text: text, height: barHeight, paddingwidth: 4, paddingheight: 0 });
}
