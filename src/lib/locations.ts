/**
 * Naming schemes for locations. A scheme is a list of segments (aisle, shelf,
 * level...) joined by a separator. Each warehouse picks a template or builds its own.
 */
export type Segment = {
  name: string;
  type: "letters" | "numbers";
  /** How many values the segment has (A..H = 8; 01..20 = 20). */
  quantity: number;
  /** Numbers only: how many digits are shown (2 → 01, 02...). */
  digits?: number;
  /** Fixed text before the value (for example "E" in E014). */
  prefix?: string;
};

export type Scheme = { id: string; separator: string; segments: Segment[] };

export const TEMPLATES: { id: string; name: string; description: string; audience: string; scheme: Scheme }[] = [
  {
    id: "aisle-shelf-level",
    name: "Pasillo · Estante · Nivel",
    description: "Una letra por pasillo, un número por estantería y un número por nivel, contando desde abajo.",
    audience: "El más común. Sirve para casi cualquier depósito con pasillos rectos.",
    scheme: {
      id: "aisle-shelf-level",
      separator: "-",
      segments: [
        { name: "Pasillo", type: "letters", quantity: 8 },
        { name: "Estante", type: "numbers", quantity: 20, digits: 2 },
        { name: "Nivel", type: "numbers", quantity: 5, digits: 1 },
      ],
    },
  },
  {
    id: "unit-level",
    name: "Estantería numerada · Nivel",
    description: "Cada estantería tiene un número corrido y cada nivel el suyo.",
    audience: "Depósitos pequeños o sin pasillos definidos: un salón con estanterías contra las paredes.",
    scheme: {
      id: "unit-level",
      separator: "-",
      segments: [
        { name: "Estantería", type: "numbers", quantity: 30, digits: 2, prefix: "E" },
        { name: "Nivel", type: "numbers", quantity: 5, digits: 1 },
      ],
    },
  },
  {
    id: "sector-aisle-shelf-level",
    name: "Sector · Pasillo · Estante · Nivel",
    description: "Agrega un sector adelante: planta baja y entrepiso, o dos galpones.",
    audience: "Depósitos con más de un ambiente o más de un piso.",
    scheme: {
      id: "sector-aisle-shelf-level",
      separator: "-",
      segments: [
        { name: "Sector", type: "numbers", quantity: 2, digits: 1, prefix: "S" },
        { name: "Pasillo", type: "letters", quantity: 6 },
        { name: "Estante", type: "numbers", quantity: 12, digits: 2 },
        { name: "Nivel", type: "numbers", quantity: 5, digits: 1 },
      ],
    },
  },
  {
    id: "shelf-level-position",
    name: "Estante · Nivel · Posición",
    description: "Numera también cada hueco del estante, de izquierda a derecha.",
    audience: "Quien guarda muchos artículos distintos por estante y quiere encontrar cada uno sin buscar.",
    scheme: {
      id: "shelf-level-position",
      separator: "-",
      segments: [
        { name: "Estante", type: "numbers", quantity: 20, digits: 2 },
        { name: "Nivel", type: "numbers", quantity: 5, digits: 1 },
        { name: "Posición", type: "numbers", quantity: 6, digits: 1, prefix: "P" },
      ],
    },
  },
];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function value(t: Segment, i: number) {
  const base = t.type === "letters" ? letters(i) : String(i + 1).padStart(t.digits ?? 1, "0");
  return (t.prefix ?? "") + base;
}

function letters(i: number): string {
  return i < 26 ? LETTERS[i] : letters(Math.floor(i / 26) - 1) + LETTERS[i % 26];
}

export function locationTotal(e: Scheme) {
  return e.segments.reduce((n, t) => n * Math.max(1, t.quantity), 1);
}

export const MAX_LOCATIONS = 20000;

/** Generates every code in the scheme, in the order the warehouse is walked. */
export function generateCodes(e: Scheme, limit = MAX_LOCATIONS): string[] {
  const output: string[] = [];
  const build = (level: number, parts: string[]) => {
    if (output.length >= limit) return;
    if (level === e.segments.length) {
      output.push(parts.join(e.separator).toUpperCase());
      return;
    }
    for (let i = 0; i < e.segments[level].quantity; i++) build(level + 1, [...parts, value(e.segments[level], i)]);
  };
  if (e.segments.length > 0) build(0, []);
  return output;
}

/** Validates a scheme coming from a form. Returns null, or the problem with its error code. */
export function validateScheme(e: Scheme): { code: string; message: string } | null {
  const problem = (code: string, message: string) => ({ code, message });
  if (e.segments.length < 1 || e.segments.length > 5) return problem("LOC-06", "El esquema necesita entre 1 y 5 tramos.");
  if (!/^[-._/ ]?$/.test(e.separator)) return problem("LOC-07", "El separador puede ser guion, punto, barra, guion bajo o nada.");
  for (const t of e.segments) {
    if (!t.name.trim()) return problem("LOC-08", "Cada tramo necesita un nombre.");
    if (!Number.isInteger(t.quantity) || t.quantity < 1 || t.quantity > 999) return problem("LOC-09", `"${t.name}": la cantidad va de 1 a 999.`);
    if (t.prefix && !/^[A-Za-z0-9]{0,4}$/.test(t.prefix)) return problem("LOC-10", `"${t.name}": el prefijo admite hasta 4 letras o números.`);
  }
  if (locationTotal(e) > MAX_LOCATIONS) return problem("LOC-11", `Son demasiadas ubicaciones (máximo ${MAX_LOCATIONS}).`);
  return null;
}
