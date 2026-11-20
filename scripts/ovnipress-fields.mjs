/**
 * Clean-up for fields scraped from the Ovnipress shop (used by scrape-ovnipress.mjs, and once
 * to fix the saved catalogue). The shop's descriptions are hand-typed: separators vary
 * ("·", "|", ","), entities slip through and sometimes a line break is missing, so the
 * author runs into "FORMATO: …" and "ISBN: …".
 */
const NAMED = { nbsp: " ", bull: "·", amp: "&", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", iexcl: "¡", iquest: "¿", ndash: "–", mdash: "—", ntilde: "ñ", Ntilde: "Ñ", ordm: "º", ordf: "ª", deg: "°" };
const MARKS = { acute: "́", grave: "̀", uml: "̈", circ: "̂" };

export const decode = (s) =>
  s
    .replace(/&([a-zA-Z])(acute|grave|uml|circ);/g, (_, v, a) => v + MARKS[a])
    .replace(/&(?:acute|#180);/g, "'") // a lone accent typed as an apostrophe (O&acute;Halloran)
    .replace(/&([a-zA-Z]+);/g, (m, n) => NAMED[n] ?? m)
    .replace(/&#0*39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .normalize("NFC");

/** The labels that follow the author in a description; when a line break is missing, the author ends at the first one. */
const NEXT_LABEL = /\s*(?:FORMATO|Formato|ISBN|Peso|Editorial|Serie|P[áa]ginas)\s*:.*$/s;

/** Names in capitals ("KEITH GIFFEN") become "Keith Giffen"; mixed case and initials stay as typed. */
const unshout = (name) => (name === name.toUpperCase() ? name.toLocaleLowerCase("es").replace(/(^|[\s.'’-])(\p{L})/gu, (_, sep, c) => sep + c.toLocaleUpperCase("es")) : name);

export function cleanAuthor(raw) {
  if (!raw) return null;
  const names = decode(raw)
    .replace(NEXT_LABEL, "")
    .split(/\s*[|·,;]\s*|\s+y\s+/)
    .map((n) => unshout(n.trim().replace(/\s+/g, " ")))
    .filter(Boolean);
  return names.length ? names.join(", ") : null;
}

export function cleanFormat(raw) {
  if (!raw) return null;
  return decode(raw).replace(/\s*(?:ISBN|Peso|Editorial)\s*:.*$/s, "").replace(/\s*\|\s*/g, " · ").trim() || null;
}
