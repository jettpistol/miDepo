import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ActionButton, ActionForm } from "@/components/ScanForm";
import { Select } from "@/components/Select";
import { Progress, Notice, PageHeader, Badge, ShelfMark } from "@/components/ui";
import { countLocations, counts, locations, users } from "@/db/schema";
import { awaitingRecount, differences, needsRecount, planCount } from "@/lib/flows/counts";
import { LOSS_CAUSES } from "@/lib/flows/adjustments";
import { can, requireSession } from "@/lib/session";
import { approve, recount, reopen } from "../actions";
import { hotkey } from "@/lib/hotkeys";
import { articleName } from "@/lib/article";

export default async function StockCount({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company, user } = await requireSession();
  const [k] = await db.select().from(counts).where(and(eq(counts.id, id), eq(counts.companyId, company.id)));
  if (!k) notFound();
  const us = await db
    .select({ u: countLocations, code: locations.code, who: users.name })
    .from(countLocations)
    .innerJoin(locations, eq(locations.id, countLocations.locationId))
    .leftJoin(users, eq(users.id, countLocations.countedBy))
    .where(eq(countLocations.countId, id))
    .orderBy(asc(locations.code));
  const countedCount = us.filter((x) => x.u.status === "counted").length;
  const isSupervisor = can(user.role, "supervisor");
  const isOpen = k.status === "open";
  const diffs = isSupervisor && isOpen ? (await differences(db, id)).filter((d) => d.system !== d.countedQty) : [];
  const waiting = isSupervisor && isOpen ? await awaitingRecount(db, id, diffs) : new Set<number>();
  const recounted = new Set(us.filter((x) => x.u.firstCountedBy != null).map((x) => x.u.locationId));
  const plan = planCount(diffs);
  // A recount covers the whole shelf: its button goes on the shelf's first flagged row only.
  const recountButtonOn = new Set<string>();
  for (const loc of waiting) {
    const first = diffs.find((d) => d.locationId === loc && needsRecount(d.system, d.countedQty));
    if (first) recountButtonOn.add(`${first.locationId}-${first.productId}`);
  }
  const units = (xs: { quantity: number }[]) => xs.reduce((s, x) => s + x.quantity, 0);
  const summary = [
    plan.relocations.length > 0 && `${units(plan.relocations)} mal ubicados (se mueven, no son pérdida)`,
    plan.found.length > 0 && `${units(plan.found)} sobran`,
    plan.losses.length > 0 && `${units(plan.losses)} faltan`,
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={k.name} back={{ href: "/conteos", text: "Conteos" }} subtitle={isOpen ? undefined : "Cerrado. Stock ajustado."} />
      <div className="mb-8 lg:mb-6 max-w-xl">
        <Progress done={countedCount} total={us.length} unit="ubicaciones" />
      </div>

      {isSupervisor && isOpen && countedCount > 0 && (
        <section className="mb-8 lg:mb-6">
          <h2 className="section-title">
            Revisión del supervisor {diffs.length > 0 && <small>{diffs.length}</small>}
          </h2>
          {diffs.length === 0 ? (
            <Notice tone="ok">Sin diferencias.</Notice>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th>Artículo</th>
                    <th className="hidden text-right sm:table-cell">Sistema</th>
                    <th className="hidden text-right sm:table-cell">Contado</th>
                    <th className="text-right">Diferencia</th>
                    <th className="w-px" />
                  </tr>
                </thead>
                <tbody>
                  {diffs.map((d) => (
                    <tr key={`${d.locationId}-${d.productId}`}>
                      <td className="w-px">
                        <ShelfMark code={d.location} />
                      </td>
                      <td>
                        <span className="font-medium">{articleName(d.title)}</span>
                        <span className="block text-muted sm:hidden">
                          Sistema {d.system} · Contado {d.countedQty}
                        </span>
                      </td>
                      <td className="hidden text-right sm:table-cell">{d.system}</td>
                      <td className="hidden text-right font-semibold sm:table-cell">{d.countedQty}</td>
                      <td className={`text-right font-semibold ${d.countedQty < d.system ? "text-danger" : "text-ok"}`}>{d.countedQty > d.system ? "+" : ""}{d.countedQty - d.system}</td>
                      <td className="w-px text-right whitespace-nowrap">
                        {recountButtonOn.has(`${d.locationId}-${d.productId}`) ? (
                          <ActionButton action={recount} hiddenFields={{ id, locationId: d.locationId }} className="btn-sm" showOk={false}>
                            Pedir recuento
                          </ActionButton>
                        ) : waiting.has(d.locationId) && needsRecount(d.system, d.countedQty) ? (
                          <Badge tone="warn">Recontar</Badge>
                        ) : recounted.has(d.locationId) ? (
                          <Badge tone="ok">Recontada</Badge>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {summary.length > 0 && <p className="mt-3 text-sm text-muted">{summary.join(" · ")}</p>}
          <ActionForm
            action={approve}
            button="Aprobar y ajustar stock"
            className="mt-4 flex flex-wrap items-end gap-2"
            resetOnOk={false}
            hotkey="finish"
            reason={waiting.size > 0 ? `Falta recontar ${waiting.size === 1 ? "1 ubicación" : `${waiting.size} ubicaciones`} con diferencias grandes, por otra persona.` : undefined}
            confirm={`Se ajustará el stock de ${countedCount} ubicaciones contadas${diffs.length ? ` (${diffs.length} diferencias)` : ""}.${countedCount < us.length ? ` Las ${us.length - countedCount} sin contar quedan como están.` : ""} ¿Cerrar el conteo?`}
          >
            <input type="hidden" name="id" value={id} />
            {plan.losses.length > 0 ? (
              <div className="w-60">
                <label className="field-label" htmlFor="cause">
                  Motivo de lo que falta
                </label>
                <Select id="cause" name="cause" options={LOSS_CAUSES.map((c) => ({ value: c.id, label: c.name }))} defaultValue="count_difference" required />
              </div>
            ) : (
              <input type="hidden" name="cause" value="count_difference" />
            )}
          </ActionForm>
        </section>
      )}

      <section>
        <h2 className="section-title">
          Ubicaciones <small>{us.length}</small>
        </h2>
        <div className="max-w-3xl table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ubicación</th>
                <th>Estado</th>
                <th className="hidden sm:table-cell">Contado por</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {us.map(({ u, code, who }) =>
                isOpen && u.status === "pending" ? (
                  <tr key={u.locationId}>
                    <td>
                      <Link href={`/conteos/${id}/${u.locationId}`}>
                        <ShelfMark code={code} size="md" />
                      </Link>
                    </td>
                    <td>{u.firstCountedBy != null && <Badge tone="warn">Recuento</Badge>}</td>
                    <td className="hidden sm:table-cell" />
                    <td className="w-px text-right">
                      <Link href={`/conteos/${id}/${u.locationId}`} className="btn-sm" {...(u.locationId === us.find((x) => x.u.status === "pending")?.u.locationId ? hotkey("primary", `Contar ${code}`) : {})}>
                        Contar
                      </Link>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.locationId}>
                    <td>
                      <ShelfMark code={code} size="md" />
                    </td>
                    <td>
                      <Badge tone="ok">Contada</Badge>
                      {who && <span className="mt-1 block text-xs text-muted sm:hidden">Contó {who}</span>}
                    </td>
                    <td className="hidden text-muted sm:table-cell">{who ?? "—"}</td>
                    <td className="w-px text-right">
                      {isOpen && isSupervisor && (
                        <ActionButton action={reopen} hiddenFields={{ id, locationId: u.locationId }} className="btn-sm" showOk={false}>
                          Reabrir
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
