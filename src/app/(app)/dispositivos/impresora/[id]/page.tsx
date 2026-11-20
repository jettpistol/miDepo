import { notFound } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq } from "drizzle-orm";
import { printers, printLog, users } from "@/db/schema";
import { Label } from "@/app/(label)/LabelPages";
import { Badge, EmptyState, PageHeader, shortDate } from "@/components/ui";
import { FAULT_TEXT } from "@/lib/flows/printers";
import { kindName } from "@/lib/flows/labels";
import { layout } from "@/lib/labels/kinds";
import { LANGUAGE_NAME } from "@/lib/labels/models";
import { sizeById } from "@/lib/labels/sizes";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Impresora demo" };

/** A demo printer's output tray: each job as it would come out, and the program it received. */
export default async function DemoTray({ params }: { params: Promise<{ id: string }> }) {
  const { db, company } = await requireSession();
  const [p] = await db.select().from(printers).where(and(eq(printers.id, Number((await params).id)), eq(printers.companyId, company.id)));
  if (!p || p.connection !== "demo") notFound();
  const who = alias(users, "who");
  const jobs = await db.select({ j: printLog, who: who.name }).from(printLog).leftJoin(who, eq(who.id, printLog.userId)).where(and(eq(printLog.companyId, company.id), eq(printLog.printerId, p.id))).orderBy(desc(printLog.id)).limit(10);

  return (
    <>
      <PageHeader title={p.name} subtitle={`Demo · ${LANGUAGE_NAME[p.language]} · ${p.dpi} dpi${p.fault ? ` · ${FAULT_TEXT[p.fault]}` : ""}`} back={{ href: "/dispositivos#impresoras", text: "Dispositivos" }} />
      {jobs.length === 0 && <EmptyState title="Sin trabajos" />}
      <div className="space-y-6">
        {jobs.map(({ j, who }) => {
          const size = sizeById(j.sizeId);
          const shown = j.content.slice(0, 4);
          return (
            <section key={j.id} className="rounded-control border border-line bg-surface p-4">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold">{kindName(j.kind)}</span>
                <span className="text-muted">
                  {shortDate(j.createdAt)} · {who ?? "—"} · {size?.name ?? j.sizeId} · {j.labels === 1 ? "1 etiqueta" : `${j.labels} etiquetas`}
                </span>
                {j.error ? <Badge tone="danger">{j.error}</Badge> : <Badge tone="ok">Impreso</Badge>}
              </p>
              {!j.error && size && (
                <div className="mt-3 flex flex-wrap gap-3 overflow-x-auto">
                  {shown.map((l, i) => (
                    <div key={i} className="shrink-0 border border-line-strong">
                      <Label doc={layout(l, size)} />
                    </div>
                  ))}
                  {j.content.length > shown.length && <p className="self-center text-sm text-muted">{j.content.length - shown.length} más</p>}
                </div>
              )}
              {j.program && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium">{LANGUAGE_NAME[p.language]} recibido</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-control bg-sunken p-3 font-mono text-xs leading-relaxed">{j.program}</pre>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
