import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { companies, locations, products, receivings, suppliers } from "@/db/schema";
import { createCompany, createUser } from "@/db/seed";
import { sync } from "@/lib/fierro";
import { moveStock } from "@/lib/stock";
import { FEATURES, searchFeatures } from "@/lib/search/functions";
import { searchInventory } from "@/lib/search/inventory";
import { searchSections } from "@/lib/wiki";

const titles = (q: string, role: "operator" | "supervisor" | "admin" = "admin") => searchFeatures(q, role).map((f) => f.title);

describe("Funciones", () => {
  it("finds screens, actions and settings by name and by the other words people use", () => {
    expect(titles("recepcion")[0]).toBe("Recepción");
    expect(titles("color")).toContain("Color de acento");
    expect(titles("tejuelos")).toContain("Ubicaciones");
    expect(titles("modo oscuro")).toContain("Tema claro u oscuro");
    expect(titles("nueva devolucion")[0]).toBe("Nueva devolución");
  });

  it("forgives one wrong letter and missing accents", () => {
    expect(titles("recpcion")).toContain("Recepción");
    expect(titles("contrasena")).toContain("Cambiar contraseña");
  });

  it("hides what the role cannot open", () => {
    expect(titles("usuarios", "operator")).not.toContain("Usuarios");
    expect(titles("usuarios", "admin")).toContain("Usuarios");
    expect(titles("fierro", "operator")).toEqual([]);
  });

  it("finds nothing for nonsense", () => expect(titles("zzqx")).toEqual([]));

  it("links only to screens and sections that exist", () => {
    const app = path.join(process.cwd(), "src/app");
    for (const f of FEATURES) {
      const [withQuery, hash] = f.href.split("#");
      // A query string picks a tab of the screen (/mover?modo=todo): the screen is what must exist.
      const route = withQuery.split("?")[0];
      if (route.startsWith("/ayuda/")) {
        expect(existsSync(path.join(process.cwd(), "wiki", `${route.slice(7)}.md`)), f.href).toBe(true);
        continue;
      }
      // Print views live outside the app shell: A4 pages in (print), label views in (label).
      const groups = route.startsWith("/imprimir") || route.startsWith("/etiquetas/") ? ["(print)", "(label)"] : route === "/ayuda" ? ["(manual)"] : ["(app)"];
      const file = route === "/ayuda" ? path.join(app, "(manual)", "ayuda/[[...page]]/page.tsx") : (groups.map((g) => path.join(app, g, route, "page.tsx")).find((f) => existsSync(f)) ?? path.join(app, groups[0], route, "page.tsx"));
      expect(existsSync(file), f.href).toBe(true);
      if (!hash) continue;
      const source = readFileSync(file, "utf8");
      // "#nueva" opens the screen's NewButton; any other hash is a section's id.
      expect(hash === "nueva" ? source.includes("<NewButton") : source.includes(`id="${hash}"`), f.href).toBe(true);
    }
  });
});

describe("Guías", () => {
  it("opens the manual at the section where the words are", async () => {
    const [hit] = await searchSections("articulo no esta");
    expect(hit.page).toBe("Picking");
    expect(hit.href).toBe("/ayuda/Picking#si-el-articulo-no-esta");
  });
  it("needs every word in the same section", async () => expect(await searchSections("zzqx picking")).toEqual([]));
});

describe("Inventario", () => {
  let db: DB;
  let companyId: number;
  let book: typeof products.$inferSelect;

  beforeAll(async () => {
    await runMigrations();
    db = await getDb();
    const base = await createCompany(db, { name: "Búsqueda SA", slug: "busqueda" });
    const [e] = await db.update(companies).set({ simSeed: 7, simTitles: 30, simCustomers: 3, simOrders: 2, simReceipts: 2 }).where(eq(companies.id, base.id)).returning();
    await createUser(db, e.id, { name: "Prueba", email: "busqueda@prueba.test", role: "admin", password: "long-password" });
    const [a] = await db.insert(locations).values(["A-01-1", "A-01-2"].map((code) => ({ companyId: e.id, code }))).returning();
    await sync(db, e);
    companyId = e.id;
    [book] = await db.select().from(products).where(eq(products.companyId, e.id)).limit(1);
    await moveStock(db, { companyId, productId: book.id, fromId: null, toId: a.id, quantity: 4, reason: "initial" });
  });

  it("puts a scanned barcode first, marked exact, with its units", async () => {
    const [first] = await searchInventory(db, companyId, book.barcode);
    expect(first).toMatchObject({ kind: "product", href: `/stock/${book.id}`, exact: true, aside: "4 unidades" });
  });

  it("finds locations by the start of their code", async () => {
    const hits = await searchInventory(db, companyId, "a-01");
    expect(hits.filter((h) => h.kind === "location").map((h) => h.title)).toEqual(["A-01-1", "A-01-2"]);
    expect((await searchInventory(db, companyId, "A-01-2"))[0]).toMatchObject({ kind: "location", exact: true });
  });

  it("finds a receiving by its number and by its supplier's name", async () => {
    const [r] = await db.select().from(receivings).where(eq(receivings.companyId, companyId)).limit(1);
    expect((await searchInventory(db, companyId, r.number))[0]).toMatchObject({ kind: "document", href: `/recepcion/${r.id}`, exact: true });
    const [s] = await db.select().from(suppliers).where(eq(suppliers.id, r.supplierId));
    expect((await searchInventory(db, companyId, s.name)).map((h) => h.href)).toContain(`/recepcion/${r.id}`);
    expect((await searchInventory(db, companyId, s.name)).find((h) => h.kind === "party")).toMatchObject({ title: s.name, href: `/proveedores/${s.id}` });
  });

  it("never shows another company's data", async () => {
    const other = await createCompany(db, { name: "Otra SA", slug: "otra-busqueda" });
    expect(await searchInventory(db, other.id, book.barcode)).toEqual([]);
  });
});
