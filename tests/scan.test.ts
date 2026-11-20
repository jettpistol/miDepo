import { describe, expect, it } from "vitest";
import { cleanScan, fixLayout, isbn10to13, locationCandidates, productCandidates, validEan13 } from "@/lib/scan";

describe("scan clean-up", () => {
  it("drops control characters and AIM prefixes", () => {
    expect(cleanScan("]E09789500700016\r\n")).toBe("9789500700016");
    expect(cleanScan("\tA-01-1 ")).toBe("A-01-1");
  });
  it("undoes a US scanner typing on a Spanish keyboard", () => {
    expect(fixLayout("A'01'1")).toBe("A-01-1");
    expect(fixLayout("CAJA?3")).toBe("CAJA_3");
    expect(locationCandidates("a'01'1")).toEqual(["A'01'1", "A-01-1"]);
  });
  it("offers EAN-13 without add-ons, UPC-A as EAN-13 and ISBN-10 as ISBN-13", () => {
    expect(validEan13("9789500700016")).toBe(true);
    expect(productCandidates("978950070001612")).toContain("9789500700016");
    expect(productCandidates("978950070001651999")).toContain("9789500700016");
    expect(productCandidates("036000291452")).toContain("0036000291452");
    expect(productCandidates("03600029145200112")).toContain("0036000291452");
    expect(isbn10to13("950070001X".slice(0, 9) + "X")).toMatch(/^978950070001\d$/);
    expect(productCandidates("84-376-0494-X")).toContain("9788437604947");
    expect(productCandidates("978-950-07-0001-6")).toContain("9789500700016");
  });
  it("puts the code as read first", () => {
    expect(productCandidates("SKU-1")[0]).toBe("SKU-1");
    expect(productCandidates("1234")).toEqual(["1234"]);
  });
});

describe("scanner hint", async () => {
  const { looksScanned } = await import("@/lib/scanner");
  it("tells a scanner burst from typing", () => {
    expect(looksScanned([0, 8, 16, 25, 33, 41])).toBe(true);
    expect(looksScanned([0, 40, 80, 120])).toBe(true);
    expect(looksScanned([0, 140, 260, 410, 520])).toBe(false);
    expect(looksScanned([0, 5, 10])).toBe(false);
  });
});
