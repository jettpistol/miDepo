import { and, asc, desc, eq, gt, like, ne, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import { orderLines, orders, products, receivingLines, receivings, stock, pickTasks, locations, transferLines, transfers } from "@/db/schema";
import { MAX_COUNT_LOCATIONS } from "./flows/counts";
import { boxByCode, cannotLoad, parseBoxCode } from "./flows/dispatch";
import { locationByCode, locationName, productByCode } from "./stock";
import { fixLayout } from "./scan";
import { articleName } from "@/lib/article";

/**
 * Rehearsal of a scan form: checks what was typed with the same rules as the real action,
 * before confirming, and suggests what to type. Changes nothing; the action validates everything again.
 */
export type FieldStatus = { tone: "ok" | "warn" | "danger"; text: string };
export type Suggestion = { value: string; type: "location" | "product"; title: string; detail?: string };
/** A value that can be set with one tap: "Está en A-01-1", "Todas: 60". */
export type Shortcut = { field: string; value: string; text: string; shelfMark?: boolean; suffix?: string };
export type Lookup = { statuses: Record<string, FieldStatus>; suggestions: Suggestion[]; shortcuts: Shortcut[] };

const LOCATION_FIELDS = ["source", "destination", "location"];
/** In picking, control and packing the scan proves which book is in hand: nothing is suggested there. */
const NO_SUGGESTIONS = ["picking", "batch-picking", "control", "packing", "dispatch"];
const clean = (q: string) => q.replace(/[%_\\]/g, "");

/** "cronicas luna" finds "Crónicas de la Luna Roja": no accents, no capitals, words may be skipped. */
export function containsText(column: AnyColumn, text: string): SQL {
  const plain = clean(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return sql`translate(lower(${column}), 'áéíóúüñ', 'aeiouun') like ${`%${plain.split(/\s+/).join("%")}%`}`;
}
const units = (n: number) => (n === 1 ? "1 unidad" : `${n} unidades`);

export async function runLookup(db: DB, companyId: number, p: URLSearchParams): Promise<Lookup> {
  const v = (k: string) => (p.get(k) ?? "").trim();
  const ctx = v("ctx");
  const statuses: Record<string, FieldStatus> = {};
  const shortcuts: Shortcut[] = [];
  const suggestions: Suggestion[] = [];

  if (ctx === "dispatch") {
    // A box label: "PED-00012-C2". While it does not look like one yet, the user is still typing.
    const code = v("box");
    if (parseBoxCode(code)) {
      const row = await boxByCode(db, companyId, code);
      const why = row ? cannotLoad(row) : `"${code}" no es la etiqueta de una caja.`;
      statuses.box = why ? { tone: "danger", text: why } : { tone: "ok", text: `${row!.order.number} · caja ${row!.box.number} · ${row!.customer}` };
    }
    return { statuses, suggestions, shortcuts };
  }

  if (ctx === "new-count") {
    const pre = clean(v("prefix")).toUpperCase();
    if (pre) {
      const rows = await db
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.companyId, companyId), eq(locations.type, "shelf"), eq(locations.active, true), like(locations.code, `${pre}%`)))
        .limit(MAX_COUNT_LOCATIONS + 1);
      statuses.prefix =
        rows.length === 0
          ? { tone: "danger", text: `Ninguna ubicación empieza con "${pre}".` }
          : rows.length > MAX_COUNT_LOCATIONS
            ? { tone: "danger", text: `Son más de ${MAX_COUNT_LOCATIONS}. Divide el conteo en tramos más pequeños.` }
            : { tone: "ok", text: rows.length === 1 ? "1 ubicación" : `${rows.length} ubicaciones` };
    }
    return { statuses, suggestions, shortcuts };
  }

  const matchesProduct = (q: string): SQL => {
    const c = clean(q);
    return or(like(products.barcode, `${c}%`), like(products.isbn, `${c}%`), like(products.internalCode, `${c.toUpperCase()}%`), containsText(products.title, c), containsText(products.author, c))!;
  };

  const location = (code: string) => (code ? locationByCode(db, companyId, code) : Promise.resolve(null));
  const product = (code: string) => (code ? productByCode(db, companyId, code) : Promise.resolve(null));
  /** Where a title is, from most to fewest units. */
  const whereIs = (productId: number, shelvesOnly = false) =>
    db
      .select({ id: locations.id, code: locations.code, type: locations.type, quantity: stock.quantity })
      .from(stock)
      .innerJoin(locations, eq(locations.id, stock.locationId))
      .where(and(eq(stock.productId, productId), gt(stock.quantity, 0), eq(locations.active, true), shelvesOnly ? eq(locations.type, "shelf") : ne(locations.type, "staging")))
      .orderBy(desc(stock.quantity))
      .limit(8);

  /** Status of a location field: whether it exists, whether it is active and how much it holds. */
  async function checkLocation(field: string, u: Awaited<ReturnType<typeof location>>) {
    const text = v(field);
    if (!text) return;
    if (!u) {
      // As long as what was typed is the start of some code, the user is still typing.
      const [prefixMatch] = await db.select({ id: locations.id }).from(locations).where(and(eq(locations.companyId, companyId), like(locations.code, `${clean(fixLayout(text.toUpperCase()))}%`))).limit(1);
      if (!prefixMatch) statuses[field] = { tone: "danger", text: `No existe la ubicación "${text.toUpperCase()}".` };
      return;
    }
    if (!u.active) return void (statuses[field] = { tone: "danger", text: `"${u.code}" está desactivada.` });
    const [present] = await db.select({ titles: sql<number>`count(*)`.mapWith(Number), n: sql<number>`coalesce(sum(${stock.quantity}), 0)`.mapWith(Number) }).from(stock).where(and(eq(stock.locationId, u.id), gt(stock.quantity, 0)));
    const name = u.type === "shelf" ? "" : `${locationName(u)} · `;
    statuses[field] = { tone: "ok", text: present.n === 0 ? `${name}Vacía` : `${name}${present.titles === 1 ? "1 artículo" : `${present.titles} artículos`} · ${units(present.n)}` };
  }
  /** If the code belongs to no book and resembles none either, say so. */
  async function flagUnknown(text: string) {
    if (text.length < 3) return;
    const [similar] = await db.select({ id: products.id }).from(products).where(and(eq(products.companyId, companyId), matchesProduct(text))).limit(1);
    if (!similar) statuses.product = { tone: "danger", text: `"${text}" no está en el catálogo.` };
  }

  const n = Number(v("quantity"));
  const quantity = Number.isInteger(n) && n > 0 ? n : null;
  const book = await product(v("product"));
  if (v("product") && !book) await flagUnknown(v("product"));

  let source: Awaited<ReturnType<typeof location>> = null;

  if (ctx === "transfer-out") {
    // Taking units to an outside location: the source must hold them, like a move.
    source = await location(v("source"));
    await checkLocation("source", source);
    if (source?.active && !["shelf", "clearance", "receiving", "returns"].includes(source.type)) statuses.source = { tone: "danger", text: "De esa ubicación no se sacan artículos para una salida." };
    if (book) {
      const present = source?.active ? ((await whereIs(book.id)).find((l) => l.id === source!.id)?.quantity ?? 0) : null;
      if (present === 0) statuses.product = { tone: "danger", text: `"${articleName(book.title)}" no está en ${locationName(source!)}.` };
      else if (present != null) {
        statuses.product = { tone: "ok", text: `${articleName(book.title)} · ${present} en ${locationName(source!)}` };
        if (present > 1 && quantity !== present) shortcuts.push({ field: "quantity", value: String(present), text: `Todas: ${present}` });
        if (quantity && quantity > present) statuses.quantity = { tone: "danger", text: `En ${locationName(source!)} hay ${present}.` };
      } else statuses.product = { tone: "ok", text: articleName(book.title) };
    }
  } else if (ctx === "transfer-back") {
    // What comes back must have gone out with this transfer, and not more than is still away.
    if (book) {
      const [l] = await db
        .select({ l: transferLines })
        .from(transferLines)
        .innerJoin(transfers, eq(transfers.id, transferLines.transferId))
        .where(and(eq(transfers.id, Number(v("id"))), eq(transfers.companyId, companyId), eq(transferLines.productId, book.id)));
      const left = l ? l.l.sent - l.l.returned - l.l.sold : 0;
      if (!l) statuses.product = { tone: "danger", text: `"${articleName(book.title)}" no salió con esta salida.` };
      else if (left === 0) statuses.product = { tone: "danger", text: `"${articleName(book.title)}": ya volvió todo.` };
      else {
        statuses.product = { tone: "ok", text: `${articleName(book.title)} · quedan ${left} afuera` };
        if (left > 1 && quantity !== left) shortcuts.push({ field: "quantity", value: String(left), text: `Todas: ${left}` });
        if (quantity && quantity > left) statuses.quantity = { tone: "danger", text: `Quedan ${left} afuera.` };
      }
    }
  } else if (ctx === "move" || ctx === "putaway" || ctx === "move-all") {
    source = await location(v("source"));
    const destination = await location(v("destination"));
    await checkLocation("source", source);
    await checkLocation("destination", destination);
    // Moving a whole location: an empty one has nothing to move.
    if (ctx === "move-all" && source?.active && statuses.source?.text.endsWith("Vacía")) statuses.source = { tone: "danger", text: `${source.code} está vacía.` };
    for (const [field, u] of [["source", source], ["destination", destination]] as const) {
      if (u?.active && u.type === "staging") statuses[field] = { tone: "danger", text: "Los pedidos preparados no se mueven manualmente." };
    }
    if (destination?.active && destination.type === "missing") statuses.destination = { tone: "danger", text: "Nada pasa a Faltantes manualmente." };
    for (const [field, u] of [["source", source], ["destination", destination]] as const) {
      if (u?.active && u.type === "outside") statuses[field] = { tone: "danger", text: "Lo que sale del depósito o vuelve va por Salidas." };
    }
    if (source && destination && source.id === destination.id) statuses.destination = { tone: "danger", text: "Es la misma ubicación que el origen." };

    if (book) {
      const places = await whereIs(book.id);
      if (source?.active) {
        const present = places.find((l) => l.id === source!.id)?.quantity ?? 0;
        if (present === 0) {
          statuses.product = { tone: "danger", text: `"${articleName(book.title)}" no está en ${locationName(source)}.` };
        } else {
          statuses.product = { tone: "ok", text: `${articleName(book.title)} · ${present} en ${locationName(source)}` };
          if (present > 1 && quantity !== present) shortcuts.push({ field: "quantity", value: String(present), text: `Todas: ${present}` });
          if (quantity && quantity > present) statuses.quantity = { tone: "danger", text: `En ${locationName(source)} hay ${present}.` };
        }
      } else {
        statuses.product = { tone: "ok", text: articleName(book.title) };
      }
      // What solves the problem, one tap away: where to take it from and where it already lives.
      if (ctx === "move" && (!source || statuses.product.tone === "danger")) {
        for (const l of places.slice(0, 3)) shortcuts.push({ field: "source", value: l.code, text: "Está en", shelfMark: true, suffix: `· ${l.quantity}` });
      }
      if (!v("destination")) {
        const livesAt = places.find((l) => l.type === "shelf" && l.id !== source?.id);
        if (livesAt) shortcuts.push({ field: "destination", value: livesAt.code, text: "Ubicación actual", shelfMark: true });
      }
    }
  } else if (ctx === "picking") {
    const [t] = await db
      .select({ t: pickTasks, code: locations.code })
      .from(pickTasks)
      .innerJoin(orders, eq(orders.id, pickTasks.orderId))
      .leftJoin(locations, eq(locations.id, pickTasks.locationId))
      .where(and(eq(pickTasks.id, Number(v("taskId"))), eq(orders.companyId, companyId)));
    if (t) {
      const u = await location(v("location"));
      await checkLocation("location", u);
      if (u?.active) statuses.location = u.id === t.t.locationId ? { tone: "ok", text: "Ubicación correcta" } : { tone: "danger", text: `Estás en ${u.code}. Esta parada es en ${t.code}.` };
      if (book) statuses.product = book.id === t.t.productId ? { tone: "ok", text: articleName(book.title) } : { tone: "danger", text: `Ese es "${articleName(book.title)}". No es el artículo de esta parada.` };
      const remaining = t.t.quantity - t.t.picked;
      if (quantity && quantity > remaining) statuses.quantity = { tone: "danger", text: `Esta parada pide ${remaining}.` };
    }
  } else if (ctx === "batch-picking") {
    // A stop of a batch: one shelf and one title, the units of several orders.
    const [stop] = await db
      .select({ code: locations.code, n: sql<number>`coalesce(sum(${pickTasks.quantity} - ${pickTasks.picked}), 0)`.mapWith(Number) })
      .from(pickTasks)
      .innerJoin(orders, eq(orders.id, pickTasks.orderId))
      .innerJoin(locations, eq(locations.id, pickTasks.locationId))
      .where(and(eq(orders.companyId, companyId), eq(orders.batchId, Number(v("batchId"))), eq(pickTasks.status, "pending"), eq(pickTasks.locationId, Number(v("locationId"))), eq(pickTasks.productId, Number(v("productId")))))
      .groupBy(locations.code);
    if (stop) {
      const u = await location(v("location"));
      await checkLocation("location", u);
      if (u?.active) statuses.location = u.id === Number(v("locationId")) ? { tone: "ok", text: "Es la ubicación de esta parada" } : { tone: "danger", text: `Estás en ${u.code}. Esta parada es en ${stop.code}.` };
      if (book) statuses.product = book.id === Number(v("productId")) ? { tone: "ok", text: articleName(book.title) } : { tone: "danger", text: `Ese es "${articleName(book.title)}". No es el artículo de esta parada.` };
      if (quantity && quantity > stop.n) statuses.quantity = { tone: "danger", text: `Esta parada pide ${stop.n}.` };
    }
  } else if (ctx === "receiving" && book) {
    const [r] = await db.select().from(receivings).where(and(eq(receivings.id, Number(v("id"))), eq(receivings.companyId, companyId)));
    statuses.product = { tone: "ok", text: articleName(book.title) };
    if (r) {
      const [l] = await db.select().from(receivingLines).where(and(eq(receivingLines.receivingId, r.id), eq(receivingLines.productId, book.id)));
      if (l && l.expected > 0) {
        statuses.product = { tone: "ok", text: `${articleName(book.title)} · ${l.received} de ${l.expected}` };
        if (quantity && l.received + quantity > l.expected) statuses.quantity = { tone: "warn", text: `${l.received + quantity - l.expected} de más.` };
      } else if (l) {
        statuses.product = { tone: "ok", text: `${articleName(book.title)} · ${l.received}` };
      } else if (r.fierroId) {
        statuses.product = { tone: "warn", text: `${articleName(book.title)} · fuera del aviso` };
      }
    }
  } else if (ctx === "packing" && book) {
    const [l] = await db
      .select({ l: orderLines })
      .from(orderLines)
      .innerJoin(orders, eq(orders.id, orderLines.orderId))
      .where(and(eq(orderLines.orderId, Number(v("id"))), eq(orderLines.productId, book.id), eq(orders.companyId, companyId)));
    const left = l ? l.l.picked - l.l.packed : 0;
    if (!l || l.l.picked === 0) statuses.product = { tone: "danger", text: `"${articleName(book.title)}" no está entre lo preparado para este pedido.` };
    else if (left === 0) statuses.product = { tone: "danger", text: `"${articleName(book.title)}": todo empacado.` };
    else {
      statuses.product = { tone: "ok", text: `${articleName(book.title)} · quedan ${left} por empacar` };
      if (left > 1 && quantity !== left) shortcuts.push({ field: "quantity", value: String(left), text: `Todas: ${left}` });
      if (quantity && quantity > left) statuses.quantity = { tone: "danger", text: `Quedan ${left} por empacar.` };
    }
  } else if (ctx === "control" && book) {
    const [l] = await db
      .select({ l: orderLines })
      .from(orderLines)
      .innerJoin(orders, eq(orders.id, orderLines.orderId))
      .where(and(eq(orderLines.orderId, Number(v("id"))), eq(orderLines.productId, book.id), eq(orders.companyId, companyId)));
    const left = l ? l.l.picked - l.l.checked : 0;
    if (!l || l.l.picked === 0) statuses.product = { tone: "danger", text: `"${articleName(book.title)}" no está en el pedido.` };
    else if (left === 0) statuses.product = { tone: "danger", text: `"${articleName(book.title)}": todo controlado.` };
    else {
      statuses.product = { tone: "ok", text: `${articleName(book.title)} · quedan ${left} por controlar` };
      if (left > 1 && quantity !== left) shortcuts.push({ field: "quantity", value: String(left), text: `Todas: ${left}` });
      if (quantity && quantity > left) statuses.quantity = { tone: "danger", text: `Quedan ${left} por controlar.` };
    }
  } else if (book) {
    statuses.product = { tone: "ok", text: articleName(book.title) };
  }

  // Suggestions for the field being typed in.
  const field = v("field");
  if (field && !NO_SUGGESTIONS.includes(ctx)) {
    const q = v(field);
    if (LOCATION_FIELDS.includes(field)) {
      const seen = new Set<string>();
      const pre = clean(q).toUpperCase();
      // First, the places where the chosen book already is.
      if (book && (ctx === "move" || ctx === "putaway" || ctx === "transfer-out")) {
        for (const l of await whereIs(book.id, field === "destination")) {
          if (!l.code.startsWith(pre) || (field === "destination" && l.id === source?.id)) continue;
          seen.add(l.code);
          suggestions.push({ value: l.code, type: "location", title: l.code, detail: field === "source" ? `${l.quantity} de este artículo` : `ya hay ${l.quantity}` });
        }
      }
      if (pre) {
        const rows = await db.select({ code: locations.code }).from(locations).where(and(eq(locations.companyId, companyId), eq(locations.active, true), ne(locations.type, "staging"), field === "destination" ? ne(locations.type, "missing") : undefined, like(locations.code, `${pre}%`))).orderBy(asc(locations.code)).limit(8);
        for (const f of rows) if (!seen.has(f.code)) suggestions.push({ value: f.code, type: "location", title: f.code });
      }
    } else if (field === "product") {
      const codes = (x: { barcode: string; author: string | null }) => [x.barcode, x.author].filter(Boolean).join(" · ");
      if ((ctx === "move" || ctx === "putaway" || ctx === "transfer-out") && source?.active) {
        // Only what is really at the source: anything else could not be moved.
        const rows = await db
          .select({ barcode: products.barcode, title: products.title, author: products.author, quantity: stock.quantity })
          .from(stock)
          .innerJoin(products, eq(products.id, stock.productId))
          .where(and(eq(stock.locationId, source.id), gt(stock.quantity, 0), q ? matchesProduct(q) : undefined))
          .orderBy(asc(products.title))
          .limit(8);
        for (const f of rows) suggestions.push({ value: f.barcode, type: "product", title: articleName(f.title), detail: `${f.barcode} · hay ${f.quantity}` });
      } else if (q.length >= 2) {
        const rows = await db.select({ barcode: products.barcode, title: products.title, author: products.author }).from(products).where(and(eq(products.companyId, companyId), matchesProduct(q))).orderBy(asc(products.title)).limit(8);
        for (const f of rows) suggestions.push({ value: f.barcode, type: "product", title: articleName(f.title), detail: codes(f) });
      }
    }
  }
  // If the only thing left to suggest is what is already typed, there is nothing to suggest.
  if (suggestions.length === 1 && suggestions[0].value.toUpperCase() === v(field).toUpperCase()) suggestions.length = 0;

  return { statuses, suggestions: suggestions.slice(0, 8), shortcuts };
}
