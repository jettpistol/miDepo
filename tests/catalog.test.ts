import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/lib/fierro/ovnipress-catalog.json";

describe("Ovnipress demo catalogue (scraped)", () => {
  it("has at least 100 titles, each with name, price and a cover that exists on disk", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(100);
    for (const t of catalog) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.price).toBeGreaterThan(0);
      expect(existsSync(`public${t.cover}`), t.cover).toBe(true);
    }
  });
  it("has no repeated ISBN or title, and every ISBN has 13 digits", () => {
    const isbns = catalog.flatMap((t) => (t.isbn ? [t.isbn] : []));
    expect(new Set(isbns).size).toBe(isbns.length);
    expect(isbns.every((i) => /^\d{13}$/.test(i))).toBe(true);
    expect(new Set(catalog.map((t) => t.title)).size).toBe(catalog.length);
  });
  it("keeps authors clean: names separated by commas, no other fields or HTML codes mixed in", () => {
    for (const t of catalog) {
      if (!t.author) continue;
      expect(t.author, t.title).not.toMatch(/FORMATO|ISBN|Peso|\||&[a-z#0-9]+;|,\s*$|^\s|\s$/i);
    }
  });
});
