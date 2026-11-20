import { and, desc, eq, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { locations, movements, products, stock, stockLoads, users } from "@/db/schema";
import { UserError } from "../errors";
import { moveStock } from "../stock";
import { nextNumber, type Ctx } from "./common";

/**
 * The opening stock load: what is already on the shelves on the day a warehouse starts with
 * miDepo, read from a spreadsheet saved as CSV. See D43 in docs/DECISIONS.md.
 *
 * Columns: code (barcode, ISBN or SKU), quantity, location. A header row is optional and may name
 * them in Spanish or English in any order; the separator may be comma, semicolon or tab.
 */

const MAX_ROWS = 20000;
/** Zones that can hold opening stock. Preparados and Faltantes only fill from picking. */
const LOADABLE = new Set(["shelf", "receiving", "returns", "damaged", "clearance"]);

const plain = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const HEADERS = {
  code: ["codigo", "code", "isbn", "sku", "ean", "barcode", "codigo de barras", "articulo"],
  quantity: ["cantidad", "quantity", "qty", "unidades", "stock"],
  location: ["ubicacion", "location", "estante", "posicion"],
} as const;

export type LoadRow = { line: number; code: string; quantity: string; location: string; title?: string; locationCode?: string; error?: string };
export type LoadCheck = { rows: LoadRow[]; lines: number; units: number; errors: number; tooMany: boolean };

function splitRows(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const first = lines.find((l) => l.trim()) ?? "";
  const sep = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  return lines.map((l, i) => ({ line: i + 1, cells: l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim()) })).filter((r) => r.cells.some((c) => c));
}

/** Reads the file and says, row by row, what would be loaded and what is wrong. Changes nothing. */
export async function checkLoad(db: Executor, companyId: number, text: string): Promise<LoadCheck> {
  let rows = splitRows(text);
  // Column order from the header if there is one; otherwise code, quantity, location.
  let col = { code: 0, quantity: 1, location: 2 };
  const head = rows[0]?.cells.map(plain) ?? [];
  const found = Object.fromEntries(Object.entries(HEADERS).map(([k, names]) => [k, head.findIndex((h) => (names as readonly string[]).includes(h))]));
  if (Object.values(found).some((i) => i >= 0)) {
    col = { code: found.code, quantity: found.quantity, location: found.location };
    rows = rows.slice(1);
  }
  const tooMany = rows.length > MAX_ROWS;
  rows = rows.slice(0, MAX_ROWS);

  const prods = await db.select({ id: products.id, title: products.title, barcode: products.barcode, isbn: products.isbn, sku: products.internalCode }).from(products).where(eq(products.companyId, companyId));
  const byCode = new Map<string, (typeof prods)[number]>();
  for (const p of prods) {
    for (const k of [p.barcode, p.isbn, p.sku?.toUpperCase()]) if (k && !byCode.has(k)) byCode.set(k, p);
  }
  const locs = new Map((await db.select().from(locations).where(eq(locations.companyId, companyId))).map((l) => [l.code, l]));

  const out: LoadRow[] = [];
  let units = 0;
  for (const r of rows) {
    const get = (i: number) => (i >= 0 ? (r.cells[i] ?? "") : "");
    const row: LoadRow = { line: r.line, code: get(col.code), quantity: get(col.quantity), location: get(col.location) };
    const p = byCode.get(row.code) ?? byCode.get(row.code.toUpperCase());
    const l = locs.get(row.location.toUpperCase());
    const n = Number(row.quantity);
    if (col.code < 0 || col.quantity < 0 || col.location < 0) row.error = "Faltan columnas: código, cantidad y ubicación.";
    else if (!row.code) row.error = "Falta el código.";
    else if (!p) row.error = "Ese código no está en el catálogo.";
    else if (!Number.isInteger(n) || n <= 0 || n > 100000) row.error = "La cantidad tiene que ser un número entero mayor que cero.";
    else if (!row.location) row.error = "Falta la ubicación.";
    else if (!l) row.error = "Esa ubicación no existe. Créala en Ubicaciones.";
    else if (!l.active) row.error = "Esa ubicación está desactivada.";
    else if (!LOADABLE.has(l.type)) row.error = "En esa zona no se carga stock inicial.";
    if (p) row.title = p.title;
    if (l) row.locationCode = l.code;
    if (!row.error) units += n;
    out.push(row);
  }
  const errors = out.filter((r) => r.error).length;
  return { rows: out, lines: out.length, units, errors, tooMany };
}

/** Loads the file if every row is right: each unit enters its location as opening stock. */
export async function applyLoad(c: Ctx, text: string, fileName: string | null) {
  const check = await checkLoad(c.db, c.companyId, text);
  if (check.tooMany) throw new UserError("STK-16", `El archivo tiene más de ${MAX_ROWS} filas. Divídelo en varios.`);
  if (check.lines === 0) throw new UserError("STK-17", "El archivo no tiene filas para cargar.");
  if (check.errors > 0) throw new UserError("STK-18", `${check.errors === 1 ? "Una fila tiene" : `${check.errors} filas tienen`} errores. Corrígelas y vuelve a subir el archivo.`);

  const prods = await c.db.select({ id: products.id, barcode: products.barcode, isbn: products.isbn, sku: products.internalCode }).from(products).where(eq(products.companyId, c.companyId));
  const byCode = new Map<string, number>();
  for (const p of prods) for (const k of [p.barcode, p.isbn, p.sku?.toUpperCase()]) if (k && !byCode.has(k)) byCode.set(k, p.id);
  const locs = new Map((await c.db.select({ id: locations.id, code: locations.code }).from(locations).where(eq(locations.companyId, c.companyId))).map((l) => [l.code, l.id]));
  // The same article and location twice in the file add up to one movement.
  const sum = new Map<string, number>();
  for (const r of check.rows) {
    const key = `${byCode.get(r.code) ?? byCode.get(r.code.toUpperCase())}:${locs.get(r.locationCode!)}`;
    sum.set(key, (sum.get(key) ?? 0) + Number(r.quantity));
  }
  return c.db.transaction(async (tx) => {
    const number = await nextNumber(tx, stockLoads, stockLoads.number, eq(stockLoads.companyId, c.companyId), "CI-", 5);
    for (const [key, quantity] of sum) {
      const [productId, locationId] = key.split(":").map(Number);
      await moveStock(tx, { companyId: c.companyId, productId, fromId: null, toId: locationId, quantity, reason: "initial", reference: number, userId: c.userId });
    }
    await tx.insert(stockLoads).values({ companyId: c.companyId, number, fileName: fileName?.slice(0, 200) || null, lines: check.lines, units: check.units, createdBy: c.userId });
    return `${number}: ${check.units} ${check.units === 1 ? "unidad cargada" : "unidades cargadas"} en ${sum.size} ${sum.size === 1 ? "ubicación y artículo" : "combinaciones de ubicación y artículo"}.`;
  });
}

/**
 * Takes a load back off the shelves (a wrong file). Only while every unit it loaded is still
 * where it was put: once some moved or were picked, the load is part of history; a count fixes it.
 */
export async function undoLoad(c: Ctx, loadId: number) {
  const [load] = await c.db.select().from(stockLoads).where(and(eq(stockLoads.id, loadId), eq(stockLoads.companyId, c.companyId)));
  if (!load) throw new UserError("STK-19", "No se encontró esa carga.");
  if (load.undoneAt) throw new UserError("STK-20", `La carga ${load.number} ya se deshizo.`);
  return c.db.transaction(async (tx) => {
    const moved = await tx
      .select({ productId: movements.productId, locationId: movements.toId, quantity: sql<number>`sum(${movements.quantity})`.mapWith(Number) })
      .from(movements)
      .where(and(eq(movements.companyId, c.companyId), eq(movements.reason, "initial"), eq(movements.reference, load.number)))
      .groupBy(movements.productId, movements.toId);
    for (const m of moved) {
      const [here] = await tx.select({ n: stock.quantity }).from(stock).where(and(eq(stock.productId, m.productId), eq(stock.locationId, m.locationId!)));
      if ((here?.n ?? 0) < m.quantity) throw new UserError("STK-21", `Parte de la carga ${load.number} ya se movió. Corrige las diferencias con un conteo.`);
    }
    for (const m of moved) {
      await moveStock(tx, { companyId: c.companyId, productId: m.productId, fromId: m.locationId, toId: null, quantity: m.quantity, reason: "undo", reference: load.number, userId: c.userId });
    }
    await tx.update(stockLoads).set({ undoneAt: new Date() }).where(eq(stockLoads.id, load.id));
    return `Carga ${load.number} deshecha: ${load.units} ${load.units === 1 ? "unidad sale" : "unidades salen"} del stock.`;
  });
}

export async function listLoads(db: DB, companyId: number) {
  return db
    .select({ l: stockLoads, by: users.name })
    .from(stockLoads)
    .innerJoin(users, eq(users.id, stockLoads.createdBy))
    .where(eq(stockLoads.companyId, companyId))
    .orderBy(desc(stockLoads.createdAt))
    .limit(50);
}
