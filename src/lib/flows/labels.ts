import { and, asc, eq, gt, ilike, isNull, like, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { boxes, carriers, customers, labelJobs, locations, orders, products, receivingLines, receivings, returnLines, returns, type BookCondition } from "@/db/schema";
import { articleName } from "../article";
import { UserError } from "../errors";
import { LABEL_KINDS, type LabelKind, type StoredLabel } from "../labels/kinds";
import type { Ctx } from "./common";

/**
 * Label jobs: labels a step prepared (a receiving closed, an order packed, a return closed,
 * locations created) or someone asked for from a record. They wait in Etiquetas for one click;
 * nothing prints on its own. See docs/hardware/README.md, "Label catalogue".
 */

/** The most labels one job holds: about 40 A4 sheets of 24, or a full roll. */
export const MAX_LABELS = 960;

export const GRADE: Record<BookCondition, string> = { sellable: "VENDIBLE", clearance: "SALDO", damaged: "DAÑADO" };

const totalOf = (labels: StoredLabel[]) => labels.reduce((s, l) => s + l.copies, 0);

/** Stores a job. Nothing is stored when there is nothing to print. */
export async function prepareLabels(tx: Executor, c: Ctx, j: { kind: LabelKind; reference: string; source: string; labels: StoredLabel[]; automatic?: boolean }) {
  const total = totalOf(j.labels);
  if (total === 0) return null;
  const [job] = await tx
    .insert(labelJobs)
    .values({ companyId: c.companyId, kind: j.kind, reference: j.reference, source: j.source, labels: j.labels, total, automatic: j.automatic ?? true, createdBy: c.userId })
    .returning();
  return job;
}

/** One label per unit received. `withoutIsbn`: only articles whose code is miDepo's own (grapas, packs). */
export async function receivingLabels(tx: Executor, receivingId: number, withoutIsbn: boolean): Promise<StoredLabel[]> {
  const rows = await tx
    .select({ title: products.title, code: products.barcode, sku: products.internalCode, n: receivingLines.received })
    .from(receivingLines)
    .innerJoin(products, eq(products.id, receivingLines.productId))
    .where(and(eq(receivingLines.receivingId, receivingId), gt(receivingLines.received, 0), withoutIsbn ? isNull(products.isbn) : undefined))
    .orderBy(asc(products.title));
  return rows.map((r) => ({ kind: "item", data: { name: articleName(r.title), code: r.code, sku: r.sku }, copies: r.n }));
}

/** One label per closed box of an order, read now: carrier, remito and tracking as they are. */
export async function boxLabels(db: Executor, companyId: number, orderId: number, company: string): Promise<StoredLabel[]> {
  const [o] = await db
    .select({ o: orders, customer: customers, carrier: carriers.name })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(carriers, eq(carriers.id, orders.carrierId))
    .where(and(eq(orders.id, orderId), eq(orders.companyId, companyId)));
  if (!o) return [];
  const list = await db.select().from(boxes).where(and(eq(boxes.orderId, orderId), eq(boxes.status, "closed"))).orderBy(asc(boxes.number));
  const city = [o.customer.city, o.customer.province].filter(Boolean).join(", ") || null;
  return list.map((b) => ({
    kind: "box",
    copies: 1,
    data: {
      order: o.o.number,
      box: b.number,
      boxes: list.length,
      customer: o.customer.name,
      address: o.customer.address,
      city,
      carrier: o.carrier,
      remito: o.o.remitoNumber,
      tracking: o.o.trackingNumber,
      kilos: b.weightGrams ? ((b.weightGrams ?? 0) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) : null,
      company,
    },
  }));
}

/** One sticker per returned unit, with its grade. */
export async function returnLabels(tx: Executor, returnId: number): Promise<StoredLabel[]> {
  const rows = await tx
    .select({ number: returns.number, title: products.title, code: products.barcode, grade: returnLines.bookCondition, n: returnLines.quantity })
    .from(returnLines)
    .innerJoin(returns, eq(returns.id, returnLines.returnId))
    .innerJoin(products, eq(products.id, returnLines.productId))
    .where(eq(returnLines.returnId, returnId))
    .orderBy(asc(returnLines.bookCondition), asc(products.title));
  return rows.map((r) => ({ kind: "condition", data: { grade: GRADE[r.grade], name: articleName(r.title), code: r.code, document: r.number }, copies: r.n }));
}

export const locationLabels = (codes: string[]): StoredLabel[] => codes.map((code) => ({ kind: "location", data: { code }, copies: 1 }));

/** What a job prints now: its snapshot, or for box labels, the boxes as they are. */
export async function jobLabels(db: Executor, companyId: number, job: typeof labelJobs.$inferSelect, company: string) {
  const order = /^order:(\d+)$/.exec(job.source);
  if (job.kind === "box" && order) return boxLabels(db, companyId, Number(order[1]), company);
  return job.labels;
}

export async function jobById(db: Executor, companyId: number, id: number) {
  const [job] = await db.select().from(labelJobs).where(and(eq(labelJobs.id, id), eq(labelJobs.companyId, companyId)));
  if (!job) throw new UserError("LBL-01", "No se encontraron esas etiquetas.");
  return job;
}

export type Source = { kind: LabelKind; reference: string; labels: StoredLabel[]; job: typeof labelJobs.$inferSelect | null };

/**
 * What a print view shows and prints, from its `origen`: a prepared job (`job:7`), an order's boxes
 * (`order:5`), every unit of a receiving (`receiving:12`), active shelves by prefix (`locations:A-01`)
 * or one exactly (`location:A-01-1`), articles without ISBN by name (`products:batman`), or a test label.
 */
export async function resolveSource(db: Executor, companyId: number, company: string, source: string): Promise<Source> {
  const [type, ...rest] = source.split(":");
  const arg = rest.join(":");
  const id = Number(arg);
  if (type === "job") {
    const job = await jobById(db, companyId, id);
    return { kind: job.kind, reference: job.reference, labels: await jobLabels(db, companyId, job, company), job };
  }
  if (type === "order") {
    const [o] = await db.select({ number: orders.number }).from(orders).where(and(eq(orders.id, id), eq(orders.companyId, companyId)));
    if (!o) throw new UserError("LBL-04", "No se encontró ese pedido.");
    return { kind: "box", reference: o.number, labels: await boxLabels(db, companyId, id, company), job: null };
  }
  if (type === "receiving") {
    const [r] = await db.select({ number: receivings.number }).from(receivings).where(and(eq(receivings.id, id), eq(receivings.companyId, companyId)));
    if (!r) throw new UserError("LBL-03", "No se encontró esa recepción.");
    return { kind: "item", reference: r.number, labels: await receivingLabels(db, id, false), job: null };
  }
  if (type === "locations" || type === "location") {
    const pre = arg.trim().toUpperCase().replace(/[%_]/g, "");
    const rows = await db
      .select({ code: locations.code })
      .from(locations)
      .where(and(eq(locations.companyId, companyId), eq(locations.type, "shelf"), eq(locations.active, true), type === "location" ? eq(locations.code, pre) : like(locations.code, `${pre}%`)))
      .orderBy(asc(locations.code))
      .limit(MAX_LABELS);
    return { kind: "location", reference: pre || "Todas", labels: locationLabels(rows.map((r) => r.code)), job: null };
  }
  if (type === "products") {
    const q = arg.trim().replace(/[%_\\]/g, "");
    const rows = q
      ? await db
          .select()
          .from(products)
          .where(and(eq(products.companyId, companyId), isNull(products.isbn), ilike(products.title, `%${q.split(/\s+/).join("%")}%`)))
          .orderBy(asc(products.title))
          .limit(MAX_LABELS)
      : [];
    return { kind: "item", reference: q, labels: rows.map((p) => ({ kind: "item", data: { name: articleName(p.title), code: p.barcode, sku: p.internalCode }, copies: 1 })), job: null };
  }
  if (type === "test") return { kind: "test", reference: "Prueba", labels: [], job: null };
  throw new UserError("LBL-02", "Origen de etiquetas desconocido.");
}

/** Box labels prepared when an order finishes packing: read again when printed. */
export async function prepareBoxLabels(tx: Executor, c: Ctx, orderId: number, number: string, boxCount: number, automatic = true) {
  // Still pending from an earlier packing of the same order: the same job, with the new box count.
  const [pending] = await tx.select().from(labelJobs).where(and(eq(labelJobs.companyId, c.companyId), eq(labelJobs.source, `order:${orderId}`), isNull(labelJobs.printedAt), isNull(labelJobs.discardedAt))).limit(1);
  if (pending) return (await tx.update(labelJobs).set({ total: boxCount }).where(eq(labelJobs.id, pending.id)).returning())[0];
  const [job] = await tx.insert(labelJobs).values({ companyId: c.companyId, kind: "box", reference: number, source: `order:${orderId}`, labels: [], total: boxCount, automatic, createdBy: c.userId }).returning();
  return job;
}

/** Takes a job off the pending list without printing it. */
export async function discardLabels(c: Ctx, id: number) {
  const job = await jobById(c.db, c.companyId, id);
  if (job.printedAt || job.discardedAt) throw new UserError("LBL-05", "Esas etiquetas ya no están pendientes.");
  await c.db.update(labelJobs).set({ discardedAt: new Date() }).where(eq(labelJobs.id, id));
  return "Descartadas.";
}

/** Puts a discarded job back on the pending list. */
export async function restoreLabels(c: Ctx, id: number) {
  await jobById(c.db, c.companyId, id);
  await c.db.update(labelJobs).set({ discardedAt: null }).where(eq(labelJobs.id, id));
  return "Pendientes.";
}

export async function pendingLabels(db: DB, companyId: number) {
  const [r] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(labelJobs).where(and(eq(labelJobs.companyId, companyId), isNull(labelJobs.printedAt), isNull(labelJobs.discardedAt)));
  return r.n;
}

export const kindName = (k: LabelKind) => LABEL_KINDS[k].name;
