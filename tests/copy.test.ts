import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The app addresses the user as tú, never with voseo. This scans the interface code, the manual
 * and the error catalogue for voseo forms. A word list cannot catch everything: when new copy
 * uses a verb not listed here, write it in tú and, if it was ever written in voseo, add it.
 */

const ROOT = path.resolve(__dirname, "..");

const VOSEO = `
abrí abrís aceptá acordate alejá andá anotá apretá apuntá armá avisá avisale bajá buscá cambiá cambiás cargá cargalo cerrá completá
confirmá confirmás contá contala contalo corregí corregilo creá crealos decí decilo dejá dejala dejalo dejás devolvé elegí elegilo elegís
empezá entrá entrás escaneá escaneala escanealo escaneás escribí escribilo esperá fijate filtrá generá guardá guardalos guardás
habilitalo hacé imprimí ingresá leé llevá llevalo llevás marcás mirá miralo mové movelos numerá partí pasale pasáselo pedí pedile
pedíselo pegá pegalas perdés permití pesala poné ponele podés probá quedate querés recargá recordás recortá recortalas registrá
registrala repetí revisá revisalos sabés sacás salí salís seguí separalo sincronizá sos tené tenés tocá tocalo tomá usá usalo vení
volvé vos
`.trim().split(/\s+/);

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx|md)$/.test(name) ? [full] : [];
  });

const LETTER = "A-Za-zÁÉÍÓÚáéíóúñÑü";
const pattern = new RegExp(`(?<![${LETTER}])(${VOSEO.join("|")})(?![${LETTER}])`, "giu");

/** The app never speaks as "I": "No se encontró ese pedido", not "No encuentro ese pedido". */
const FIRST_PERSON = `
anoté busqué cambié conozco creé encontré encuentro estoy guardé moví necesito pude puedo registré sumé tengo terminé voy
`.trim().split(/\s+/);
const firstPerson = new RegExp(`(?<![${LETTER}])(${FIRST_PERSON.join("|")})(?![${LETTER}])`, "giu");

describe("Spanish copy", () => {
  const copy = [...files(path.join(ROOT, "src")), ...files(path.join(ROOT, "wiki")), path.join(ROOT, "docs/ERRORS.md")];
  const find = (re: RegExp) =>
    copy.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        // Code comments are English and may say "I"; only the copy matters.
        .flatMap((line, i) => (/^\s*(\/\/|\*|\/\*)/.test(line) ? [] : [...line.matchAll(re)].map((m) => `${path.relative(ROOT, file)}:${i + 1}: ${m[1]}`))),
    );

  it("uses tú, never voseo", () => {
    expect(find(pattern)).toEqual([]);
  });

  it("never speaks in the first person", () => {
    expect(find(firstPerson)).toEqual([]);
  });
});
