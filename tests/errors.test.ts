import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UserError, attempt, withCode } from "@/lib/errors";

/**
 * Keeps docs/ERRORS.md and the code in step: every error code used in src/ is documented,
 * every documented code is used in the file its row names, no code is used in two files,
 * and retired codes stay retired.
 */

const ROOT = path.resolve(__dirname, "..");
const AREAS = ["SYS", "AUTH", "PKEY", "ACCT", "USER", "LOC", "STK", "RCV", "PICK", "PACK", "RET", "CNT", "EXP", "CAM", "CFG", "CLI"];
const CODE = new RegExp(`\\b(?:${AREAS.join("|")})-\\d{2}\\b`, "g");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const sources = sourceFiles(path.join(ROOT, "src")).map((file) => ({ file: path.relative(ROOT, file), text: readFileSync(file, "utf8") }));

/** Code → files that use it. */
const used = new Map<string, Set<string>>();
for (const s of sources) for (const code of s.text.match(CODE) ?? []) used.set(code, (used.get(code) ?? new Set()).add(s.file));

const doc = readFileSync(path.join(ROOT, "docs/ERRORS.md"), "utf8");
const [active, retired = ""] = doc.split(/^## Retired codes$/m);
/** Rows of the catalogue: | `CODE` | message | `file` · function | when | */
const rows = [...active.matchAll(/^\| `([A-Z]+-\d{2})` \|[^|]*\| `([^`]+)`/gm)].map((m) => ({ code: m[1], file: m[2] }));
const retiredCodes = [...retired.matchAll(/^\| `([A-Z]+-\d{2})` \|/gm)].map((m) => m[1]);

describe("error catalogue (docs/ERRORS.md)", () => {
  it("documents every code used in src/", () => {
    const documented = new Set(rows.map((r) => r.code));
    expect([...used.keys()].filter((c) => !documented.has(c)).sort()).toEqual([]);
  });

  it("documents each code once, in a known area", () => {
    const seen = rows.map((r) => r.code);
    expect(seen.filter((c, i) => seen.indexOf(c) !== i)).toEqual([]);
    expect(seen.filter((c) => !AREAS.includes(c.split("-")[0]))).toEqual([]);
  });

  it("names the file where each code is used", () => {
    const wrong = rows.filter((r) => !used.get(r.code)?.has(r.file)).map((r) => `${r.code} is not in ${r.file}`);
    expect(wrong).toEqual([]);
  });

  it("uses each code in one file only", () => {
    const shared = [...used].filter(([, files]) => files.size > 1).map(([code, files]) => `${code}: ${[...files].join(", ")}`);
    expect(shared).toEqual([]);
  });

  it("does not bring retired codes back", () => {
    expect(retiredCodes.filter((c) => used.has(c) || rows.some((r) => r.code === c))).toEqual([]);
  });

  it("gives every thrown error a code", () => {
    const uncoded = sources.flatMap((s) =>
      [...s.text.matchAll(/new UserError\(([^,)]*)/g), ...s.text.matchAll(/throw new Error\((["'`][^"'`]*)/g)]
        .filter((m) => (m[0].startsWith("new UserError") ? !/^"[A-Z]+-\d{2}"$/.test(m[1]) && m[1] !== "code" && m[1] !== "problem.code" : !/^["'`]\[[A-Z]+-\d{2}\]/.test(m[1])))
        .map((m) => `${s.file}: ${m[0]}`),
    );
    expect(uncoded).toEqual([]);
  });
});

describe("how codes reach the user", () => {
  it("shows a UserError's message with its code", async () => {
    const r = await attempt(async () => {
      throw new UserError("RCV-02", "Esta recepción ya está cerrada.");
    });
    expect(r.error).toBe("Esta recepción ya está cerrada. · RCV-02");
    expect(withCode("x", "SYS-01")).toBe("x · SYS-01");
  });

  it("hides unexpected errors behind SYS-01", async () => {
    const log = console.error;
    console.error = () => {};
    try {
      const r = await attempt(async () => {
        throw new Error("connection refused");
      });
      expect(r.error).toMatch(/· SYS-01$/);
      expect(r.error).not.toMatch(/connection refused/);
    } finally {
      console.error = log;
    }
  });
});
