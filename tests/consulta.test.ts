import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, migrar, type DB } from "@/db";
import { empresas, productos, ubicaciones } from "@/db/schema";
import { crearEmpresa, crearUsuario } from "@/db/seed";
import { consultar } from "@/lib/consulta";
import { ErrorUsuario } from "@/lib/errores";
import { sincronizar } from "@/lib/fierro";
import type { Ctx } from "@/lib/flujos/comun";
import { mover } from "@/lib/flujos/mover";
import { moverStock } from "@/lib/stock";

let db: DB;
let c: Ctx;
let libro: typeof productos.$inferSelect;
let otro: typeof productos.$inferSelect;

const ensayo = (q: Record<string, string>) => consultar(db, c.empresaId, new URLSearchParams(q));

beforeAll(async () => {
  await migrar();
  db = await getDb();
  const base = await crearEmpresa(db, { nombre: "Ensayo SA", slug: "ensayo" });
  const [e] = await db.update(empresas).set({ simSemilla: 5, simTitulos: 40, simClientes: 3, simPedidos: 0, simIngresos: 0 }).where(eq(empresas.id, base.id)).returning();
  const u = await crearUsuario(db, e.id, { nombre: "Prueba", email: "ensayo@prueba.test", rol: "admin", clave: "clave-larga" });
  const [a] = await db.insert(ubicaciones).values(["A-01-1", "A-01-2", "B-01-1"].map((codigo) => ({ empresaId: e.id, codigo }))).returning();
  await sincronizar(db, e);
  c = { db, empresaId: e.id, usuarioId: u.id };
  [libro, otro] = await db.select().from(productos).where(eq(productos.empresaId, e.id)).limit(2);
  await moverStock(db, { empresaId: e.id, productoId: libro.id, desdeId: null, haciaId: a.id, cantidad: 7, motivo: "inicial" });
});

describe("ensayo de un movimiento", () => {
  it("avisa de una ubicación que no existe, pero no mientras se la está escribiendo", async () => {
    expect((await ensayo({ ctx: "mover", origen: "ZZ-9" })).estados.origen?.tono).toBe("peligro");
    const escribiendo = await ensayo({ ctx: "mover", campo: "origen", origen: "A-0" });
    expect(escribiendo.estados.origen).toBeUndefined();
    expect(escribiendo.sugerencias.map((s) => s.valor)).toEqual(["A-01-1", "A-01-2"]);
  });

  it("dice qué libro es, cuánto hay y ofrece moverlo todo", async () => {
    const r = await ensayo({ ctx: "mover", origen: "a-01-1", producto: libro.codigoBarras, cantidad: "1" });
    expect(r.estados.origen?.tono).toBe("ok");
    expect(r.estados.producto).toEqual({ tono: "ok", texto: `${libro.titulo} · hay 7 en A-01-1` });
    expect(r.atajos).toContainEqual({ campo: "cantidad", valor: "7", texto: "Todas: 7" });
  });

  it("frena antes lo mismo que la acción rechazaría después", async () => {
    const casos = [
      { origen: "A-01-1", producto: otro.codigoBarras, destino: "B-01-1", cantidad: "1", campo: "producto" },
      { origen: "A-01-1", producto: libro.codigoBarras, destino: "B-01-1", cantidad: "8", campo: "cantidad" },
      { origen: "A-01-1", producto: libro.codigoBarras, destino: "A-01-1", cantidad: "1", campo: "destino" },
      { origen: "A-01-1", producto: "0000000", destino: "B-01-1", cantidad: "1", campo: "producto" },
    ];
    for (const { campo, ...d } of casos) {
      expect((await ensayo({ ctx: "mover", ...d })).estados[campo]?.tono, campo).toBe("peligro");
      await expect(mover(c, d)).rejects.toBeInstanceOf(ErrorUsuario);
    }
  });

  it("si el libro no está en el origen, ofrece el estante donde sí está", async () => {
    const r = await ensayo({ ctx: "mover", origen: "B-01-1", producto: libro.codigoBarras });
    expect(r.estados.producto?.tono).toBe("peligro");
    expect(r.atajos).toContainEqual({ campo: "origen", valor: "A-01-1", texto: "Está en", tejuelo: true, sufijo: "· 7" });
  });

  it("lo que el ensayo da por bueno, la acción lo acepta", async () => {
    const d = { origen: "A-01-1", producto: libro.codigoBarras, destino: "B-01-1", cantidad: "2" };
    const r = await ensayo({ ctx: "mover", ...d });
    expect(Object.values(r.estados).some((e) => e.tono === "peligro")).toBe(false);
    await expect(mover(c, d)).resolves.toContain(libro.titulo);
  });

  it("sugiere solo los títulos que están en el origen y busca sin tildes", async () => {
    const enOrigen = await ensayo({ ctx: "mover", campo: "producto", origen: "A-01-1" });
    expect(enOrigen.sugerencias.map((s) => s.valor)).toEqual([libro.codigoBarras]);
    const sinTildes = libro.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().slice(0, 6);
    const porTitulo = await ensayo({ ctx: "recepcion", campo: "producto", producto: sinTildes });
    expect(porTitulo.sugerencias.some((s) => s.valor === libro.codigoBarras)).toBe(true);
  });
});

describe("ensayo de un conteo nuevo", () => {
  it("cuenta las ubicaciones del tramo antes de crearlo", async () => {
    expect((await ensayo({ ctx: "conteo-nuevo", prefijo: "a-01" })).estados.prefijo).toEqual({ tono: "ok", texto: "2 ubicaciones" });
    expect((await ensayo({ ctx: "conteo-nuevo", prefijo: "Z" })).estados.prefijo?.tono).toBe("peligro");
  });
});
