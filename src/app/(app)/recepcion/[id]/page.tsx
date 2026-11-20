import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ActionButton, ScanForm } from "@/components/ScanForm";
import { Progress, Notice, Code, PageHeader, Badge } from "@/components/ui";
import { products, receivingLines, receivings, suppliers } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { close, correct, scan } from "../actions";
import { EditNumber } from "./EditNumber";
import { hotkey } from "@/lib/hotkeys";
import { articleName } from "@/lib/article";
import { Assignee } from "@/components/Assignee";

export default async function ReceivingDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const session = await requireSession();
  const { db, company } = session;
  const [row] = await db.select({ r: receivings, supplier: suppliers.name }).from(receivings).innerJoin(suppliers, eq(suppliers.id, receivings.supplierId)).where(and(eq(receivings.id, id), eq(receivings.companyId, company.id)));
  const r = row?.r;
  if (!r) notFound();
  const lines = await db
    .select({ l: receivingLines, title: products.title, code: products.barcode })
    .from(receivingLines)
    .innerJoin(products, eq(products.id, receivingLines.productId))
    .where(eq(receivingLines.receivingId, id))
    .orderBy(asc(products.title));
  const expected = lines.reduce((s, x) => s + x.l.expected, 0);
  const received = lines.reduce((s, x) => s + x.l.received, 0);
  const withDifference = lines.filter((x) => x.l.received !== x.l.expected).length;
  const open = r.status !== "closed";

  return (
    <>
      <PageHeader title={`${r.number} · ${row.supplier}`} back={{ href: "/recepcion", text: "Recepciones" }} subtitle={r.fierroId ? "Recepción avisada por Fierro" : "Recepción sin aviso"}>
        <Assignee session={session} kind="receiving" id={r.id} value={r.assignedTo} open={r.status !== "closed"} />
      </PageHeader>

      {open ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-8">
          <div className="space-y-3 lg:sticky lg:top-30">
            <ScanForm action={scan} context="receiving" hiddenFields={{ id }} fields={[{ name: "product", label: "Artículo", help: "Código, nombre o autor" }]} quantity={1} button="Sumar" />
            {expected > 0 && <Progress done={received} total={expected} unit="unidades" />}
            <div className="flex flex-wrap gap-2">
              <ActionButton action={close} hotkey="finish" hiddenFields={{ id }} className="btn w-full" reason={received === 0 ? "Sin artículos escaneados." : undefined} confirm={withDifference > 0 ? `Hay ${withDifference} artículos con una cantidad distinta a la esperada. ¿Cerrar la recepción igual?` : "¿Cerrar la recepción? No se podrá seguir escaneando."}>
                Cerrar recepción
              </ActionButton>
            </div>
          </div>
          <Lines lines={lines} id={id} editable />
        </div>
      ) : (
        <div className="space-y-6">
          <Notice tone="ok">
            Recepción cerrada con {received} unidades. {r.sentToFierro ? "Cargada en Fierro." : "Pendiente en Fierro."}{" "}
            <Link href="/reposicion" className="font-semibold underline underline-offset-[3px]" {...hotkey("primary", "Ir a reposición")}>
              Ir a reposición
            </Link>
          </Notice>
          <Lines lines={lines} id={id} />
        </div>
      )}
    </>
  );
}

function Lines({ lines, id, editable = false }: { lines: { l: typeof receivingLines.$inferSelect; title: string; code: string }[]; id: number; editable?: boolean }) {
  if (lines.length === 0) return <p className="border-y border-line px-2 py-8 text-sm text-muted lg:px-3">Sin artículos.</p>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Artículo</th>
            <th className="hidden text-right sm:table-cell">Esperado</th>
            <th className="text-right">Recibido</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map(({ l, title, code }) => (
            <tr key={l.id}>
              <td>
                <span className="block font-medium">{articleName(title)}</span>
                <Code>{code}</Code>
                {l.expected > 0 && <span className="mt-0.5 block text-muted sm:hidden">Esperado: {l.expected}</span>}
              </td>
              <td className="hidden text-right sm:table-cell">{l.expected || "—"}</td>
              <td className="text-right font-bold">{editable ? <EditNumber action={correct} hiddenFields={{ id, productId: l.productId }} field="received" value={l.received} /> : l.received}</td>
              <td className="w-px text-right">
                {l.expected === 0 ? <Badge tone="warn">No avisado</Badge> : l.received === l.expected ? <Badge tone="ok">Completo</Badge> : l.received > l.expected ? <Badge tone="warn">+{l.received - l.expected}</Badge> : l.received > 0 ? <Badge tone="accent">Faltan {l.expected - l.received}</Badge> : <Badge>Pendiente</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
