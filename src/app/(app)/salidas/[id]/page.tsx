import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ActionButton, ActionForm, ScanForm } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { Badge, Code, EmptyRow, PageHeader, plural, shortDate } from "@/components/ui";
import { locations, transfers } from "@/db/schema";
import { articleName } from "@/lib/article";
import { transferLinesOf } from "@/lib/flows/transfers";
import { can, requireSession } from "@/lib/session";
import { back, close, leave, send, unsend } from "../actions";
import { TRANSFER_STATE } from "../state";

export default async function Transfer({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company, user } = await requireSession();
  const [row] = await db.select({ t: transfers, place: locations }).from(transfers).innerJoin(locations, eq(locations.id, transfers.locationId)).where(and(eq(transfers.id, id), eq(transfers.companyId, company.id)));
  if (!row) notFound();
  const { t, place } = row;
  const lines = await transferLinesOf(db, id);
  const sent = lines.reduce((s, x) => s + x.l.sent, 0);
  const away = lines.reduce((s, x) => s + x.l.sent - x.l.returned - x.l.sold, 0);
  const state = TRANSFER_STATE[t.status];

  return (
    <>
      <PageHeader title={`${t.number} · ${place.name ?? place.code}`} subtitle={[t.remitoNumber && `Remito ${t.remitoNumber}`, t.sentAt && `Salió ${shortDate(t.sentAt)}`, t.closedAt && `Cerrada ${shortDate(t.closedAt)}`].filter(Boolean).join(" · ") || undefined} back={{ href: "/salidas", text: "Salidas" }}>
        <Badge tone={state.tone}>{state.label}</Badge>
        {lines.length > 0 && (
          <Link href={`/imprimir/salida/${id}`} target="_blank" className="btn-soft">
            <Icon name="print" /> Lista
          </Link>
        )}
        {t.status === "away" && can(user.role, "supervisor") && (
          <ActionButton action={close} hiddenFields={{ id }} className="btn-soft" confirm={away > 0 ? `¿Cerrar ${t.number}? ${plural(away, "unidad no volvió", "unidades no volvieron")}: salen del stock como vendidas en ${place.name ?? place.code}. No se puede deshacer.` : `¿Cerrar ${t.number}? Volvió todo.`}>
            Cerrar salida
          </ActionButton>
        )}
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-8">
        {t.status === "sending" && (
          <div className="space-y-4 lg:sticky lg:top-30">
            <ScanForm
              action={send}
              context="transfer-out"
              hiddenFields={{ id }}
              fields={[
                { name: "source", label: "Origen", help: "Ubicación" },
                { name: "product", label: "Artículo", help: "Código, nombre o autor" },
              ]}
              quantity={1}
              button="Sumar"
            />
            <ActionForm action={leave} button="Sale del depósito" reason={sent === 0 ? "Sin artículos." : undefined} confirm={`¿Sale ${t.number} con ${plural(sent, "unidad", "unidades")}?`} className="space-y-3 [&>button]:w-full">
              <input type="hidden" name="id" value={id} />
              <div>
                <label htmlFor="remito" className="field-label">
                  Remito
                </label>
                <input id="remito" name="remito" required maxLength={60} placeholder="R 0001-00001234" className="field font-mono" />
              </div>
            </ActionForm>
          </div>
        )}
        {t.status === "away" && (
          <div className="lg:sticky lg:top-30">
            <ScanForm action={back} context="transfer-back" hiddenFields={{ id }} fields={[{ name: "product", label: "Artículo", help: "Código, nombre o autor" }]} quantity={1} button="Volvió" />
          </div>
        )}
        <div className={t.status === "closed" ? "lg:col-span-2" : ""}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th className="text-right">Salieron</th>
                  <th className="hidden text-right sm:table-cell">Volvieron</th>
                  <th className="text-right">{t.status === "closed" ? "Vendidas" : "Afuera"}</th>
                  {t.status === "sending" && <th />}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && <EmptyRow columns={4} title="Sin artículos" />}
                {lines.map(({ l, title, barcode }) => (
                  <tr key={l.id}>
                    <td>
                      <span className="block font-medium">{articleName(title)}</span>
                      <Code>{barcode}</Code>
                    </td>
                    <td className="text-right tabular-nums">{l.sent}</td>
                    <td className="hidden text-right tabular-nums sm:table-cell">{l.returned || "—"}</td>
                    <td className="text-right font-semibold tabular-nums">{t.status === "closed" ? l.sold || "—" : l.sent - l.returned - l.sold}</td>
                    {t.status === "sending" && (
                      <td className="w-px text-right">
                        <ActionButton action={unsend} hiddenFields={{ id, productId: l.productId }} className="btn-soft btn-sm" confirm={`¿Sacar ${articleName(title)} de la salida? ${plural(l.sent, "unidad va", "unidades van")} a Recepción para reponer.`}>
                          Sacar
                        </ActionButton>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
