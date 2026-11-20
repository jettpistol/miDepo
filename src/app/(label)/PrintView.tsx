import { and, eq } from "drizzle-orm";
import { printers } from "@/db/schema";
import { resolveSource } from "@/lib/flows/labels";
import { sizeProblem, targetFor, testLabels } from "@/lib/flows/printers";
import { UserError } from "@/lib/errors";
import { LABEL_KINDS } from "@/lib/labels/kinds";
import { LANGUAGE_NAME } from "@/lib/labels/models";
import { SIZES, sizeById } from "@/lib/labels/sizes";
import { can, requireSession } from "@/lib/session";
import { currentWorkstation } from "@/lib/workstation";
import { LabelPages } from "./LabelPages";
import { PrintBar } from "./PrintBar";

export type PrintParams = { tamano?: string; impresora?: string; auto?: string };

/**
 * One print view for every label in the app: the labels of a source at a size, and a bar to
 * choose size and printer and print. Defaults: this computer's choice for the kind, else the
 * system dialog at the kind's default size.
 */
export async function PrintView({ source, params, children }: { source: string; params: PrintParams; children?: React.ReactNode }) {
  const { db, company, user } = await requireSession();
  let src;
  try {
    src = await resolveSource(db, company.id, company.name, source);
  } catch (e) {
    if (e instanceof UserError) return <p className="py-10 text-center">{e.message}</p>;
    throw e;
  }
  const w = await currentWorkstation(db, company.id);
  const target = await targetFor(db, company.id, w?.id ?? null, src.kind);
  const list = (await db.select().from(printers).where(and(eq(printers.companyId, company.id), eq(printers.active, true)))).sort((a, b) => a.name.localeCompare(b.name));
  const asked = params.impresora === "dialogo" ? null : params.impresora ? (list.find((p) => p.id === Number(params.impresora)) ?? target.printer) : target.printer;
  const printer = asked && list.some((p) => p.id === asked.id) ? asked : null;
  const wanted = params.tamano ?? (printer?.id === target.printer?.id ? target.sizeId : LABEL_KINDS[src.kind].defaultSize);
  const sizeId = sizeProblem(printer, src.kind, wanted) ? (SIZES.find((s) => !sizeProblem(printer, src.kind, s.id))?.id ?? LABEL_KINDS[src.kind].defaultSize) : wanted;
  const size = sizeById(sizeId)!;
  const labels = src.kind === "test" ? testLabels(printer, sizeId) : src.labels;
  const total = labels.reduce((s, l) => s + l.copies, 0);

  return (
    <>
      <PrintBar
        source={source}
        kind={src.kind}
        title={src.kind === "test" ? "Etiqueta de prueba" : `${LABEL_KINDS[src.kind].name} · ${src.reference}`}
        total={total}
        sizes={SIZES.filter((s) => !sizeProblem(printer, src.kind, s.id)).map((s) => ({ value: s.id, label: s.name }))}
        sizeId={sizeId}
        printers={[
          { value: "dialogo", label: "Diálogo del sistema" },
          ...list.map((p) => ({ value: String(p.id), label: p.name, detail: p.connection === "demo" ? `Demo · ${LANGUAGE_NAME[p.language]} ${p.dpi} dpi` : (p.model ?? undefined) })),
        ]}
        printerId={printer?.id ?? null}
        direct={Boolean(printer && printer.connection !== "dialog")}
        isDefault={(printer?.id ?? null) === (target.printer?.id ?? null) && sizeId === target.sizeId}
        canKeep={can(user.role, "supervisor")}
        auto={params.auto === "1"}
        printed={src.job?.printedAt ? src.job.prints : 0}
      />
      <div className="no-print">{children}</div>
      <div className="px-4 pt-4 pb-10 print:p-0">{total === 0 ? <p className="py-10 text-center text-sm">Sin etiquetas.</p> : <LabelPages labels={labels} size={size} />}</div>
    </>
  );
}
