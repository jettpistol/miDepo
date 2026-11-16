import bwipjs from "bwip-js/node";

/** Código de barras Code 128 como SVG. Lo leen los lectores USB y la cámara del teléfono. */
export function barras(texto: string, alto = 12) {
  return bwipjs.toSVG({ bcid: "code128", text: texto, height: alto, paddingwidth: 4, paddingheight: 0 });
}
