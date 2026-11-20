/**
 * What a scanner sends, cleaned up before it is looked up. Shared by the flows (findProduct,
 * findLocation) and the as-you-type check (lookup.ts), so both accept exactly the same codes.
 * See docs/hardware/README.md, "Normalisation pipeline".
 *
 * Nothing here guesses: every variant is only a candidate, tried after the code as read, and
 * accepted only if it exists in the database.
 */

/** AIM symbology identifier some scanners put first: "]E0" (EAN-13), "]C1" (GS1-128), "]Q1" (QR)… */
const AIM_PREFIX = /^\][A-Za-z][0-9A-Za-z]/;

/** Trims, drops control characters (Tab, GS, CR left by the scanner) and an AIM prefix. */
export function cleanScan(raw: string) {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(AIM_PREFIX, "")
    .trim();
}

/**
 * Most scanners type as a US keyboard. On a PC set to a Spanish layout (Latin America or Spain)
 * the key for "-" types "'", and the one for "_" types "?". Undone here.
 */
export function fixLayout(s: string) {
  return s.replace(/'/g, "-").replace(/\?/g, "_");
}

/** Check digit of the first 12 digits of an EAN-13 (also UPC-A with a leading 0, and ISBN-13). */
function eanCheck(d12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export const validEan13 = (s: string) => /^\d{13}$/.test(s) && eanCheck(s) === Number(s[12]);

function validIsbn10(s: string) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === "X" ? 10 : Number(s[i])) * (10 - i);
  return sum % 11 === 0;
}

/** 950-07-0001-7 → 9789500700016. */
export function isbn10to13(s: string) {
  const d12 = `978${s.slice(0, 9)}`;
  return d12 + eanCheck(d12);
}

const unique = (list: string[]) => [...new Set(list.filter(Boolean))];

/**
 * Codes to try for an article, best first: the code as read, then
 * - an EAN-13 with a 2- or 5-digit add-on (15 or 18 digits): the EAN-13 alone (the owner does not use add-ons);
 * - a UPC-A (12 digits), alone or with an add-on: also as EAN-13 with a leading 0;
 * - an EAN-13 starting with 0: also as UPC-A;
 * - an ISBN-10 or an ISBN typed with hyphens or spaces: its ISBN-13;
 * - a SKU typed through a Spanish keyboard layout ("'" for "-").
 * Upper case is left to the caller: SKUs are compared in capitals, barcodes as they are.
 */
export function productCandidates(raw: string) {
  const s = cleanScan(raw);
  const out = [s];
  const plain = s.replace(/[-\s']/g, "").toUpperCase();
  if (/^\d+$/.test(plain)) {
    if ((plain.length === 15 || plain.length === 18) && validEan13(plain.slice(0, 13))) out.push(plain.slice(0, 13));
    if ((plain.length === 14 || plain.length === 17) && validEan13(`0${plain.slice(0, 12)}`)) out.push(plain.slice(0, 12), `0${plain.slice(0, 12)}`);
    if (plain.length === 12 && validEan13(`0${plain}`)) out.push(`0${plain}`);
    if (plain.length === 13 && validEan13(plain)) {
      out.push(plain);
      if (plain.startsWith("0")) out.push(plain.slice(1));
    }
  }
  if (validIsbn10(plain)) out.push(isbn10to13(plain));
  out.push(fixLayout(s));
  return unique(out);
}

/**
 * Codes to try for a location, best first: in capitals (CapsLock inverts what a scanner types),
 * then with the keyboard-layout fix, then with "/" for "-" (a "/" in the label arrives as "-").
 */
export function locationCandidates(raw: string) {
  const s = cleanScan(raw).toUpperCase();
  return unique([s, fixLayout(s), s.replace(/-/g, "/")]);
}

/** Of the rows found for some candidates, the one matching the earliest candidate. */
export function best<T>(rows: T[], candidates: string[], keys: (row: T) => (string | null | undefined)[]) {
  let found: T | null = null;
  let rank = Infinity;
  for (const r of rows) {
    const k = keys(r);
    for (const value of k) {
      const i = value == null ? -1 : candidates.indexOf(value);
      if (i >= 0 && i < rank) {
        rank = i;
        found = r;
      }
    }
  }
  return found;
}
