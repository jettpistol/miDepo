/** Color de acento por usuario. El azul Klein es el de fábrica. */
export const ACENTO_DE_FABRICA = "#002FA7";

export const PALETA: { nombre: string; hex: string }[] = [
  { nombre: "Azul Klein", hex: "#002FA7" },
  { nombre: "Violeta", hex: "#6D28D9" },
  { nombre: "Magenta", hex: "#BE185D" },
  { nombre: "Rojo", hex: "#C81E1E" },
  { nombre: "Naranja", hex: "#C2410C" },
  { nombre: "Ámbar", hex: "#B45309" },
  { nombre: "Verde", hex: "#15803D" },
  { nombre: "Turquesa", hex: "#0F766E" },
  { nombre: "Celeste", hex: "#0369A1" },
  { nombre: "Grafito", hex: "#374151" },
];

export const HEX_VALIDO = /^#[0-9a-fA-F]{6}$/;

type RGB = [number, number, number];
const aRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const aHex = (c: RGB) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mezclar = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;

function luminancia(c: RGB) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a: RGB, b: RGB) => {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const BLANCO: RGB = [255, 255, 255];
const NEGRO: RGB = [10, 15, 36];
const SUPERFICIE_OSCURA: RGB = [22, 28, 58];

/** Acerca el color al blanco o al negro hasta que se lea bien sobre el fondo dado. */
function legible(color: RGB, fondo: RGB, hacia: RGB) {
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mezclar(color, hacia, t);
    if (contraste(c, fondo) >= 4.5) return aHex(c);
  }
  return aHex(hacia);
}

/**
 * Variables CSS que dependen del acento elegido. Cualquier color sirve: el texto encima del
 * acento y el acento usado como texto se ajustan solos para que siempre se puedan leer.
 */
export function variablesDeAcento(hex: string): Record<string, string> {
  const acento = aRgb(HEX_VALIDO.test(hex) ? hex : ACENTO_DE_FABRICA);
  return {
    "--acento": aHex(acento),
    "--sobre-acento": contraste(acento, BLANCO) >= 4.5 ? "#ffffff" : aHex(NEGRO),
    "--acento-texto-claro": legible(acento, BLANCO, NEGRO),
    "--acento-texto-oscuro": legible(acento, SUPERFICIE_OSCURA, BLANCO),
  };
}
