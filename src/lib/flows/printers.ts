import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { companies, labelJobs, printLog, printers, workstationPrinters, workstations, type DemoFault } from "@/db/schema";
import { UserError } from "../errors";
import { LABEL_KINDS, KIND_ORDER, layout, type LabelKind, type StoredLabel } from "../labels/kinds";
import { DEMO_PRINTERS, PRINTER_MODELS } from "../labels/models";
import { sizeById } from "../labels/sizes";
import { toTspl } from "../labels/tspl";
import { toZpl } from "../labels/zpl";
import { distance, plain } from "../text";
import type { Ctx } from "./common";
import { resolveSource } from "./labels";

/**
 * Printers and where each computer prints. Today a label goes through the system print dialog,
 * or, in test mode, to a demo printer that keeps what it was sent. Direct USB, serial and
 * Bluetooth printers come later behind the same `sendLabels` (docs/hardware/README.md).
 */

export type Printer = typeof printers.$inferSelect;
export type Target = { printer: Printer | null; sizeId: string };

export const FAULT_TEXT: Record<DemoFault, string> = { paper: "Sin papel", head: "Cabezal abierto", offline: "Sin conexión" };

/** Test mode on: adds the demo printers (or brings them back). Off: hides them. */
export async function setTestMode(c: Ctx, on: boolean) {
  await c.db.transaction(async (tx) => {
    await tx.update(companies).set({ testMode: on }).where(eq(companies.id, c.companyId));
    if (on) {
      const have = await tx.select({ name: printers.name }).from(printers).where(and(eq(printers.companyId, c.companyId), eq(printers.connection, "demo")));
      const missing = DEMO_PRINTERS.filter((p) => !have.some((h) => h.name === p.name));
      if (missing.length) await tx.insert(printers).values(missing.map((p) => ({ companyId: c.companyId, connection: "demo" as const, ...p })));
      await tx.update(printers).set({ active: true }).where(and(eq(printers.companyId, c.companyId), eq(printers.connection, "demo")));
    } else await tx.update(printers).set({ active: false }).where(and(eq(printers.companyId, c.companyId), eq(printers.connection, "demo")));
  });
  return on ? "Modo de prueba activado." : "Modo de prueba desactivado.";
}

/** A printer reached through the system dialog, named so each computer can be set to it. */
export async function createPrinter(c: Ctx, d: { name: string; modelId: string }) {
  const name = d.name.replace(/\s+/g, " ").trim();
  if (name.length < 2) throw new UserError("PRN-01", "Falta el nombre.");
  if (name.length > 60) throw new UserError("PRN-02", "Nombre: máximo 60 caracteres.");
  const model = PRINTER_MODELS.find((m) => m.id === d.modelId);
  if (!model) throw new UserError("PRN-03", "Elige el modelo.");
  const existing = await c.db.select({ name: printers.name }).from(printers).where(eq(printers.companyId, c.companyId));
  const same = existing.find((p) => plain(p.name) === plain(name) || (Math.min(plain(p.name).length, plain(name).length) >= 6 && distance(plain(p.name), plain(name)) <= 2));
  if (same) throw new UserError("PRN-04", `Ya existe: ${same.name}.`);
  await c.db.insert(printers).values({ companyId: c.companyId, name, model: model.name, connection: "dialog", language: model.language, dpi: model.dpi });
  return `${name} agregada.`;
}

async function printerOf(db: DB, companyId: number, id: number) {
  const [p] = await db.select().from(printers).where(and(eq(printers.id, id), eq(printers.companyId, companyId)));
  if (!p) throw new UserError("PRN-05", "No se encontró esa impresora.");
  return p;
}

export async function setPrinterActive(c: Ctx, id: number, active: boolean) {
  const p = await printerOf(c.db, c.companyId, id);
  if (p.connection === "demo") throw new UserError("PRN-06", "Las impresoras demo dependen del modo de prueba.");
  await c.db.update(printers).set({ active }).where(eq(printers.id, id));
  if (!active) await c.db.update(workstationPrinters).set({ printerId: null }).where(eq(workstationPrinters.printerId, id));
  return active ? "Reactivada." : "Desactivada.";
}

/** A demo printer's simulated state: what a real fault would look like when printing. */
export async function setDemoFault(c: Ctx, id: number, fault: string) {
  const p = await printerOf(c.db, c.companyId, id);
  if (p.connection !== "demo") throw new UserError("PRN-07", "Solo las impresoras demo simulan fallas.");
  const value = fault === "" ? null : (fault as DemoFault);
  if (value && !(value in FAULT_TEXT)) throw new UserError("PRN-08", "Estado desconocido.");
  await c.db.update(printers).set({ fault: value }).where(eq(printers.id, id));
  return "Guardado.";
}

export async function renameWorkstation(c: Ctx, id: number, raw: string) {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2) throw new UserError("PRN-09", "Falta el nombre.");
  if (name.length > 40) throw new UserError("PRN-10", "Nombre: máximo 40 caracteres.");
  const [w] = await c.db.update(workstations).set({ name }).where(and(eq(workstations.id, id), eq(workstations.companyId, c.companyId))).returning();
  if (!w) throw new UserError("PRN-11", "No se encontró ese equipo.");
  return "Guardado.";
}

/** Whether a printer can take a size: thermal printers print rolls, not A4 sheets. */
export function sizeProblem(printer: Pick<Printer, "language"> | null, kind: LabelKind, sizeId: string) {
  const size = sizeById(sizeId);
  if (!size) return "Elige un tamaño.";
  if (!LABEL_KINDS[kind].fits(size)) return `${size.name}: insuficiente para ${LABEL_KINDS[kind].name.toLowerCase()}.`;
  if (printer && printer.language !== "page" && size.sheet) return "Las hojas A4 van por el diálogo del sistema.";
  return null;
}

/** Sets this computer's printer and size for one kind of label. `printerId` null = the system dialog. */
export async function assignPrinter(c: Ctx, workstationId: number, kind: string, printerId: number | null, sizeId: string) {
  if (!KIND_ORDER.includes(kind as LabelKind)) throw new UserError("PRN-12", "Tipo de etiqueta desconocido.");
  const [w] = await c.db.select().from(workstations).where(and(eq(workstations.id, workstationId), eq(workstations.companyId, c.companyId)));
  if (!w) throw new UserError("PRN-11", "No se encontró ese equipo.");
  const printer = printerId ? await printerOf(c.db, c.companyId, printerId) : null;
  if (printer && !printer.active) throw new UserError("PRN-13", `${printer.name} está desactivada.`);
  const problem = sizeProblem(printer, kind as LabelKind, sizeId);
  if (problem) throw new UserError("PRN-14", problem);
  await c.db
    .insert(workstationPrinters)
    .values({ workstationId, kind: kind as LabelKind, printerId, sizeId })
    .onConflictDoUpdate({ target: [workstationPrinters.workstationId, workstationPrinters.kind], set: { printerId, sizeId } });
  return "Guardado.";
}

/** Where a computer prints a kind of label: its choice, or the dialog at the kind's default size. */
export async function targetFor(db: DB, companyId: number, workstationId: number | null, kind: LabelKind): Promise<Target> {
  const fallback = { printer: null, sizeId: LABEL_KINDS[kind].defaultSize };
  if (!workstationId) return fallback;
  const [row] = await db
    .select({ a: workstationPrinters, p: printers })
    .from(workstationPrinters)
    .leftJoin(printers, eq(printers.id, workstationPrinters.printerId))
    .where(and(eq(workstationPrinters.workstationId, workstationId), eq(workstationPrinters.kind, kind)));
  if (!row) return fallback;
  // A printer deactivated (or a demo one with test mode off) falls back to the dialog, at the chosen size if it fits.
  const printer = row.p && row.p.active && row.p.companyId === companyId ? row.p : null;
  return { printer, sizeId: sizeProblem(printer, kind, row.a.sizeId) ? fallback.sizeId : row.a.sizeId };
}

/** The program a printer gets for some labels: ZPL or TSPL, one block per label with its copies. */
export function program(printer: Pick<Printer, "language" | "dpi">, labels: StoredLabel[], sizeId: string) {
  const size = sizeById(sizeId)!;
  const one = printer.language === "tspl" ? toTspl : toZpl;
  return labels.map((l) => one(layout(l, size), printer.dpi, l.copies)).join(printer.language === "tspl" ? "\r\n" : "\n");
}

export type Sent = { dialog: true } | { dialog: false; message: string };

/**
 * Prints labels (a job's, or a test label): through the dialog (the page prints itself) or to a
 * printer. Every send is logged; a job counts as printed from its first send.
 */
export async function sendLabels(c: Ctx & { company: { name: string } }, d: { source: string; printerId: number | null; sizeId: string; workstationId: number }): Promise<Sent> {
  const src = await resolveSource(c.db, c.companyId, c.company.name, d.source);
  if (src.job?.discardedAt) throw new UserError("LBL-06", "Esas etiquetas están descartadas.");
  const printer = d.printerId ? await printerOf(c.db, c.companyId, d.printerId) : null;
  if (printer && !printer.active) throw new UserError("PRN-13", `${printer.name} está desactivada.`);
  const problem = sizeProblem(printer, src.kind, d.sizeId);
  if (problem) throw new UserError("PRN-14", problem);
  const labels = src.kind === "test" ? testLabels(printer, d.sizeId) : src.labels;
  if (labels.length === 0) throw new UserError("LBL-07", "Sin etiquetas para imprimir.");
  const total = labels.reduce((s, l) => s + l.copies, 0);
  const log = { companyId: c.companyId, jobId: src.job?.id ?? null, printerId: printer?.id ?? null, workstationId: d.workstationId, kind: src.kind, sizeId: d.sizeId, labels: total, content: labels, userId: c.userId };

  if (printer?.connection === "demo" && printer.fault) {
    const why = `${printer.name}: ${FAULT_TEXT[printer.fault].toLowerCase()}.`;
    await c.db.insert(printLog).values({ ...log, error: why });
    if (printer.fault === "paper") throw new UserError("PRN-15", why);
    if (printer.fault === "head") throw new UserError("PRN-16", why);
    throw new UserError("PRN-17", why);
  }
  const code = printer && printer.language !== "page" ? program(printer, labels, d.sizeId) : null;
  await c.db.insert(printLog).values({ ...log, program: code });
  const job = src.job;
  if (job) await c.db.update(labelJobs).set({ prints: sql`${labelJobs.prints} + 1`, printedAt: job.printedAt ?? new Date(), printedBy: job.printedBy ?? c.userId }).where(eq(labelJobs.id, job.id));
  if (!printer) return { dialog: true };
  return { dialog: false, message: `${total === 1 ? "1 etiqueta" : `${total} etiquetas`} a ${printer.name}.` };
}

/** The test label for a printer and size: its size, its name, a ruler and a barcode. */
export function testLabels(printer: Pick<Printer, "name" | "dpi" | "language"> | null, sizeId: string): StoredLabel[] {
  const size = sizeById(sizeId);
  const who = printer ? `${printer.name} · ${printer.language === "page" ? "diálogo" : `${printer.language.toUpperCase()} ${printer.dpi} dpi`}` : "Diálogo del sistema";
  return [{ kind: "test", data: { size: size?.name ?? sizeId, printer: who }, copies: 1 }];
}

/** What this company's printers are, with demo ones only in test mode. */
export async function companyPrinters(db: DB, companyId: number) {
  return db.select().from(printers).where(eq(printers.companyId, companyId)).orderBy(asc(printers.connection), asc(printers.name));
}

/** A demo printer's output tray: what it was sent, newest first. */
export async function trayOf(db: DB, companyId: number, printerId: number, limit = 10) {
  return db.select().from(printLog).where(and(eq(printLog.companyId, companyId), eq(printLog.printerId, printerId))).orderBy(desc(printLog.id)).limit(limit);
}

export async function workstationsOf(db: DB, companyId: number) {
  return db.select().from(workstations).where(eq(workstations.companyId, companyId)).orderBy(desc(workstations.lastSeenAt));
}

export const unprinted = and(isNull(labelJobs.printedAt), isNull(labelJobs.discardedAt));
