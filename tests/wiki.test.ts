import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { createCompany, createUser } from "@/db/seed";
import type { Ctx } from "@/lib/flows/common";
import { UserError } from "@/lib/errors";
import { renderMarkdown } from "@/lib/markdown";
import { readPage, restoreOriginal, saveEdit, search } from "@/lib/wiki";

let db: DB;
let a: Ctx;
let b: Ctx;

beforeAll(async () => {
  await runMigrations();
  db = await getDb();
  for (const [slug, i] of [["wiki-a", 0], ["wiki-b", 1]] as const) {
    const company = await createCompany(db, { name: slug, slug });
    const user = await createUser(db, company.id, { name: `Admin ${i}`, email: `${slug}@prueba.test`, role: "admin", password: "long-password" });
    const ctx = { db, companyId: company.id, userId: user.id };
    if (i === 0) a = ctx;
    else b = ctx;
  }
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof UserError ? e.code : String(e);
  }
  return null;
};

describe("manual edits", () => {
  it("replaces a page only for the company that edited it", async () => {
    await saveEdit(a, "Glosario", "# Glosario propio\n\nUn **zorzal** es un lector.\n");
    const mine = await readPage("Glosario", a.companyId);
    expect(mine?.title).toBe("Glosario propio");
    expect(mine?.edit?.by).toBe("Admin 0");
    expect(mine?.edit?.outdated).toBe(false);
    expect((await readPage("Glosario", b.companyId))?.edit).toBeNull();
    expect((await readPage("Glosario"))?.title).not.toBe("Glosario propio");
  });

  it("searches the company's version", async () => {
    expect((await search("zorzal", a.companyId)).map((h) => h.page)).toEqual(["Glosario"]);
    expect(await search("zorzal", b.companyId)).toEqual([]);
    expect(await search("zorzal")).toEqual([]);
  });

  it("goes back to the original", async () => {
    await restoreOriginal(a, "Glosario");
    expect((await readPage("Glosario", a.companyId))?.edit).toBeNull();
  });

  it("saving the original text unchanged leaves no edit", async () => {
    const page = await readPage("Picking", a.companyId);
    await saveEdit(a, "Picking", page!.original);
    expect((await readPage("Picking", a.companyId))?.edit).toBeNull();
  });

  it("refuses pages that do not exist, missing titles and huge pages", async () => {
    expect(await code(saveEdit(a, "No-existe", "# Hola\n"))).toBe("WIKI-01");
    expect(await code(saveEdit(a, "../package", "# Hola\n"))).toBe("WIKI-01");
    expect(await code(saveEdit(a, "Picking", "Sin título\n"))).toBe("WIKI-02");
    expect(await code(saveEdit(a, "Picking", "# T\n" + "x".repeat(100_001)))).toBe("WIKI-03");
    expect(await code(restoreOriginal(a, "No-existe"))).toBe("WIKI-04");
  });
});

describe("rendering", () => {
  it("never lets a page run code", () => {
    const html = renderMarkdown('# T\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[a](javascript:alert(1)) [b](//evil.example) ![c](javascript:x)');
    expect(html).not.toMatch(/<script|<img|href="javascript|href="\/\/|src="javascript/);
    expect(html).toContain("&lt;script&gt;");
  });

  it("links between pages and to the web", () => {
    const html = renderMarkdown("[Picking](Picking) [x](Conteos#recontar) [web](https://example.com)");
    expect(html).toContain('href="/ayuda/Picking"');
    expect(html).toContain('href="/ayuda/Conteos#recontar"');
    expect(html).toContain('href="https://example.com" target="_blank"');
  });
});
