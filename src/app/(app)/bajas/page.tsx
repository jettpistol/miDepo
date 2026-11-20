import { ActionForm } from "@/components/ScanForm";
import { Select } from "@/components/Select";
import { Code, EmptyRow, PageHeader, ShelfMark, shortDate } from "@/components/ui";
import { adjustmentHistory, causeName, heldStock, LOSS_CAUSES, misplacedSince, WRITE_OFF_ZONES } from "@/lib/flows/adjustments";
import { requireSession } from "@/lib/session";
import { writeOffAction } from "./actions";

export const metadata = { title: "Bajas" };

const DAYS = 90;
const CAUSE_OPTIONS = LOSS_CAUSES.map((c) => ({ value: c.id, label: c.name }));

type Held = Awaited<ReturnType<typeof heldStock>>[number];

function WriteOffForm({ h }: { h: Held }) {
  return (
    <ActionForm
      action={writeOffAction}
      button="Dar de baja"
      buttonClassName="btn-sm"
      className="flex flex-wrap items-center gap-2 md:justify-end [&>p[role=status]]:basis-full"
      confirm="¿Dar de baja estas unidades? Salen del stock y quedan para cargar en Fierro."
    >
      <input type="hidden" name="locationId" value={h.locationId} />
      <input type="hidden" name="productId" value={h.productId} />
      <input name="quantity" type="number" min={1} max={h.quantity} defaultValue={h.quantity} aria-label="Unidades" className="field w-20 text-right" required />
      <Select name="cause" label="Motivo" options={CAUSE_OPTIONS} defaultValue={WRITE_OFF_ZONES[h.zone as keyof typeof WRITE_OFF_ZONES]} required className="w-52" />
    </ActionForm>
  );
}

export default async function WriteOffs() {
  const { db, company } = await requireSession("supervisor");
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const [held, history, misplaced] = await Promise.all([heldStock(db, company.id), adjustmentHistory(db, company.id, since), misplacedSince(db, company.id, since)]);

  const byCause = new Map<string, { out: number; in: number }>();
  for (const h of history) {
    const t = byCause.get(h.cause) ?? { out: 0, in: 0 };
    if (h.quantity < 0) t.out -= h.quantity;
    else t.in += h.quantity;
    byCause.set(h.cause, t);
  }

  return (
    <>
      <PageHeader title="Bajas" />

      <section className="mb-8 lg:mb-6">
        <h2 className="section-title">
          Faltantes y dañados <small>{held.length}</small>
        </h2>
        <p className="mb-3 max-w-[70ch] text-sm text-muted">Si un faltante aparece, muévelo desde FALTANTES a su ubicación con Mover: vuelve al stock sin baja.</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th className="hidden md:table-cell">Zona</th>
                <th className="hidden text-right md:table-cell">Cantidad</th>
                <th className="hidden md:table-cell" />
              </tr>
            </thead>
            <tbody>
              {held.length === 0 && <EmptyRow columns={4} title="No hay nada en Faltantes ni en Dañados." />}
              {held.map((h) => (
                <tr key={`${h.locationId}-${h.productId}`}>
                  <td>
                    <span className="block font-medium">{h.title}</span>
                    <Code>{h.code}</Code>
                    <span className="mt-2 flex items-center gap-2 md:hidden">
                      <ShelfMark code={h.zone === "missing" ? "FALTANTES" : "DANADOS"} />
                      <span className="font-semibold tabular-nums">{h.quantity}</span>
                    </span>
                    <div className="mt-2 md:hidden">
                      <WriteOffForm h={h} />
                    </div>
                  </td>
                  <td className="hidden w-px md:table-cell">
                    <ShelfMark code={h.zone === "missing" ? "FALTANTES" : "DANADOS"} />
                  </td>
                  <td className="hidden w-px text-right font-semibold tabular-nums md:table-cell">{h.quantity}</td>
                  <td className="hidden w-px md:table-cell md:min-w-[26.5rem]">
                    <WriteOffForm h={h} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 lg:mb-6">
        <h2 className="section-title">Últimos {DAYS} días</h2>
        <div className="max-w-xl table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Motivo</th>
                <th className="text-right">Salidas</th>
                <th className="text-right">Entradas</th>
              </tr>
            </thead>
            <tbody>
              {byCause.size === 0 && <EmptyRow columns={3} title="Sin bajas ni ajustes." />}
              {[...byCause].map(([cause, t]) => (
                <tr key={cause}>
                  <td>{causeName(cause)}</td>
                  <td className="text-right tabular-nums">{t.out || "—"}</td>
                  <td className="text-right tabular-nums">{t.in || "—"}</td>
                </tr>
              ))}
              <tr>
                <td className="text-muted">Mal ubicados en conteos (no son pérdida)</td>
                <td className="text-right text-muted tabular-nums" colSpan={2}>
                  {misplaced || "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="section-title" id="history">
          Historial <small>{history.length}</small>
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Artículo</th>
                <th className="hidden md:table-cell">Ubicación</th>
                <th className="text-right">Cantidad</th>
                <th className="hidden sm:table-cell">Motivo</th>
                <th className="hidden lg:table-cell">Aprobado por</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && <EmptyRow columns={6} title="Sin bajas ni ajustes." />}
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap">
                    <span className="doc-number">{h.number}</span>
                    <span className="block text-xs text-muted">{shortDate(h.date)}</span>
                  </td>
                  <td>
                    <span className="font-medium">{h.title}</span>
                    <span className="block text-xs text-muted sm:hidden">{causeName(h.cause)}</span>
                  </td>
                  <td className="hidden w-px md:table-cell">
                    <ShelfMark code={h.location} />
                  </td>
                  <td className={`text-right font-semibold tabular-nums ${h.quantity < 0 ? "text-danger" : "text-ok"}`}>
                    {h.quantity > 0 ? "+" : ""}
                    {h.quantity}
                  </td>
                  <td className="hidden sm:table-cell">{causeName(h.cause)}</td>
                  <td className="hidden text-muted lg:table-cell">{h.approvedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
