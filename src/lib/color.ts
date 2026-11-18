/** Per-user accent colour. Klein blue is the default. */
export const DEFAULT_ACCENT = "#002FA7";

export const PALETTE: { name: string; hex: string }[] = [
  { name: "Azul Klein", hex: "#002FA7" },
  { name: "Violeta", hex: "#6D28D9" },
  { name: "Magenta", hex: "#BE185D" },
  { name: "Rojo", hex: "#C81E1E" },
  { name: "Naranja", hex: "#C2410C" },
  { name: "Ámbar", hex: "#B45309" },
  { name: "Verde", hex: "#15803D" },
  { name: "Turquesa", hex: "#0F766E" },
  { name: "Celeste", hex: "#0369A1" },
  { name: "Grafito", hex: "#374151" },
];

export const VALID_HEX = /^#[0-9a-fA-F]{6}$/;

type RGB = [number, number, number];
const toRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const toHex = (c: RGB) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;

function luminance(c: RGB) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: RGB, b: RGB) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [10, 15, 36];
const DARK_SURFACE: RGB = [22, 28, 58];

/** Moves the colour toward white or black until it reads well on the given backdrop. */
function readable(color: RGB, backdrop: RGB, toLoc: RGB) {
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mix(color, toLoc, t);
    if (contrast(c, backdrop) >= 4.5) return toHex(c);
  }
  return toHex(toLoc);
}

/**
 * CSS variables that depend on the chosen accent. Any colour works: the text on top of the
 * accent and the accent used as text adjust themselves so they can always be read.
 */
export function accentVariables(hex: string): Record<string, string> {
  const accent = toRgb(VALID_HEX.test(hex) ? hex : DEFAULT_ACCENT);
  return {
    "--accent": toHex(accent),
    "--on-accent": contrast(accent, WHITE) >= 4.5 ? "#ffffff" : toHex(BLACK),
    "--accent-text-light": readable(accent, WHITE, BLACK),
    "--accent-text-dark": readable(accent, DARK_SURFACE, WHITE),
  };
}
