/**
 * The owner's wording rules that a pattern can catch, shared by tests/copy.test.ts and the
 * project hook .claude/hooks/copy-check.mjs. The rest (fewest words, no narrative, nothing the
 * screen already says) is a judgement: see "Copy" in CLAUDE.md.
 */
const L = "A-Za-zÁÉÍÓÚáéíóúñÑü";
const word = (w) => new RegExp(`(?<![${L}])(${w})(?![${L}])`, "gu");

export const VOCABULARY = [
  { re: word("[Aa]cá"), use: "aquí" },
  { re: word("[Cc]hic[oa]s?"), use: "pequeño" },
  { re: word("[Ff]íjate"), use: "revisa" },
  { re: word("[Rr]ecién"), use: "solo, ya" },
  { re: word("[Aa]chicar"), use: "reducir" },
  { re: word("(?:[Vv]a|[Vv]an|[Vv]as) a [a-záéíóú]+(?:ar|er|ir)"), use: "futuro simple (aparecerá, no va a aparecer)" },
  { re: word("[Ll]ibros?"), use: "artículo" },
  { re: word("[Tt]ítulos?"), use: "artículo (título solo para páginas del manual)" },
  { re: word("[Cc]artel(?:es)?"), use: "etiqueta" },
  { re: word("[Aa]rm(?:a|ar|an|aste|ado|ada|ados|e|es)"), use: "preparar, crear, calcular" },
  { re: word("[Ii]ngresos? avisados?"), use: "recepción avisada" },
  { re: word("(?:documentar|documenta|informar|informa) (?:en|a) Fierro"), use: "cargar en Fierro" },
  { re: word("[Dd]ar(?:te|le|la)? de baja a"), use: "Desactivar (baja es solo para stock)" },
  { re: /(Anotado|Listo\.)/gu, use: "un hecho concreto (Registrado, Llave registrada)" },
  { re: /(¡)/gu, use: "sin exclamaciones" },
];

/** Lines where a listed word is right: the product type, search synonyms, a manual page's own title. */
export const ALLOWED = [
  /book: "Libro"/,
  /src\/lib\/search\/functions\.ts/,
  /[Tt]ítulo de sección|Subtítulo|el título|un título|Falta el título|necesita un título|título de la página|Sin título/,
  /contratapa/,
];

/** Copy files: interface code and the manual. Generated demo data is not copy. */
export const isCopyFile = (file) => /(^|\/)(src\/.+\.tsx?|wiki\/.+\.md)$/.test(file) && !/fierro\/simulated\.ts|db\/seed\.ts/.test(file);

/** Hits in one file's text: "line: word → use". Comments and imports are skipped. */
export function vocabularyHits(file, text) {
  return text.split("\n").flatMap((line, i) => {
    if (/^\s*(\/\/|\*|\/\*|import )/.test(line) || ALLOWED.some((a) => a.test(line) || a.test(file))) return [];
    return VOCABULARY.flatMap(({ re, use }) => [...line.matchAll(re)].map((m) => `${file}:${i + 1}: «${m[1]}» → ${use}`));
  });
}
