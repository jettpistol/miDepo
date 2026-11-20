import { beforeAll, describe, expect, it } from "vitest";
import { articleName } from "@/lib/article";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { companies, products, locations } from "@/db/schema";
import { createCompany, createUser } from "@/db/seed";
import { runLookup } from "@/lib/lookup";
import { UserError } from "@/lib/errors";
import { sync } from "@/lib/fierro";
import type { Ctx } from "@/lib/flows/common";
import { move } from "@/lib/flows/move";
import { moveStock } from "@/lib/stock";

let db: DB;
let c: Ctx;
let book: typeof products.$inferSelect;
let another: typeof products.$inferSelect;

const rehearsal = (q: Record<string, string>) => runLookup(db, c.companyId, new URLSearchParams(q));

beforeAll(async () => {
  await runMigrations();
  db = await getDb();
  const base = await createCompany(db, { name: "Ensayo SA", slug: "ensayo" });
  const [e] = await db.update(companies).set({ simSeed: 5, simTitles: 40, simCustomers: 3, simOrders: 0, simReceipts: 0 }).where(eq(companies.id, base.id)).returning();
  const u = await createUser(db, e.id, { name: "Prueba", email: "ensayo@prueba.test", role: "admin", password: "long-password" });
  const [a] = await db.insert(locations).values(["A-01-1", "A-01-2", "B-01-1"].map((code) => ({ companyId: e.id, code }))).returning();
  await sync(db, e);
  c = { db, companyId: e.id, userId: u.id };
  [book, another] = await db.select().from(products).where(eq(products.companyId, e.id)).limit(2);
  await moveStock(db, { companyId: e.id, productId: book.id, fromId: null, toId: a.id, quantity: 7, reason: "initial" });
});

describe("rehearsing a move", () => {
  it("flags a location that does not exist, but not while it is still being typed", async () => {
    expect((await rehearsal({ ctx: "move", source: "ZZ-9" })).statuses.source?.tone).toBe("danger");
    const typing = await rehearsal({ ctx: "move", field: "source", source: "A-0" });
    expect(typing.statuses.source).toBeUndefined();
    expect(typing.suggestions.map((s) => s.value)).toEqual(["A-01-1", "A-01-2"]);
  });

  it("says which book it is, how many there are, and offers to move them all", async () => {
    const r = await rehearsal({ ctx: "move", source: "a-01-1", product: book.barcode, quantity: "1" });
    expect(r.statuses.source?.tone).toBe("ok");
    expect(r.statuses.product).toEqual({ tone: "ok", text: `${articleName(book.title)} · 7 en A-01-1` });
    expect(r.shortcuts).toContainEqual({ field: "quantity", value: "7", text: "Todas: 7" });
  });

  it("blocks beforehand exactly what the action would reject afterwards", async () => {
    const cases = [
      { source: "A-01-1", product: another.barcode, destination: "B-01-1", quantity: "1", field: "product" },
      { source: "A-01-1", product: book.barcode, destination: "B-01-1", quantity: "8", field: "quantity" },
      { source: "A-01-1", product: book.barcode, destination: "A-01-1", quantity: "1", field: "destination" },
      { source: "A-01-1", product: "0000000", destination: "B-01-1", quantity: "1", field: "product" },
      { source: "A-01-1", product: book.barcode, destination: "FALTANTES", quantity: "1", field: "destination" },
    ];
    for (const { field, ...d } of cases) {
      expect((await rehearsal({ ctx: "move", ...d })).statuses[field]?.tone, field).toBe("danger");
      await expect(move(c, d)).rejects.toBeInstanceOf(UserError);
    }
  });

  it("if the book is not at the source, offers the shelf where it is", async () => {
    const r = await rehearsal({ ctx: "move", source: "B-01-1", product: book.barcode });
    expect(r.statuses.product?.tone).toBe("danger");
    expect(r.shortcuts).toContainEqual({ field: "source", value: "A-01-1", text: "Está en", shelfMark: true, suffix: "· 7" });
  });

  it("what the rehearsal accepts, the action accepts", async () => {
    const d = { source: "A-01-1", product: book.barcode, destination: "B-01-1", quantity: "2" };
    const r = await rehearsal({ ctx: "move", ...d });
    expect(Object.values(r.statuses).some((e) => e.tone === "danger")).toBe(false);
    await expect(move(c, d)).resolves.toContain(articleName(book.title));
  });

  it("suggests only titles at the source and searches without accents", async () => {
    const atSource = await rehearsal({ ctx: "move", field: "product", source: "A-01-1" });
    expect(atSource.suggestions.map((s) => s.value)).toEqual([book.barcode]);
    const unaccented = book.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().slice(0, 6);
    const byTitle = await rehearsal({ ctx: "receiving", field: "product", product: unaccented });
    expect(byTitle.suggestions.some((s) => s.value === book.barcode)).toBe(true);
  });
});

describe("rehearsing a new count", () => {
  it("counts the locations in the range before creating it", async () => {
    expect((await rehearsal({ ctx: "new-count", prefix: "a-01" })).statuses.prefix).toEqual({ tone: "ok", text: "2 ubicaciones" });
    expect((await rehearsal({ ctx: "new-count", prefix: "Z" })).statuses.prefix?.tone).toBe("danger");
  });
});
