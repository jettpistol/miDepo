import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { LiveSearch } from "@/components/LiveSearch";
import { EmptyRow, PageHeader, ShelfMark, shortDate } from "@/components/ui";
import { articleName } from "@/lib/article";
import { isMovementReason, listMovements, MOVEMENT_REASON_NAME, MOVEMENT_REASONS } from "@/lib/lists";
import { requireSession } from "@/lib/session";
import { ReasonFilter } from "./ReasonFilter";

export const metadata = { title: "Movimientos" };

function Place({ id, code }: { id: number | null; code: string | null }) {
  if (!id || !code) return <span className="text-muted">Fuera del depósito</span>;
  return (
    <Link href={`/ubicaciones/${id}`} className="inline-flex">
      <ShelfMark code={code} />
    </Link>
  );
}

export default async function Movements({ searchParams }: { searchParams: Promise<{ q?: string; motivo?: string; pagina?: string }> }) {
  const { db, company } = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const reason = sp.motivo && isMovementReason(sp.motivo) ? sp.motivo : undefined;
  const page = requestedPage(sp.pagina);
  const { total, rows } = await listMovements(db, company.id, { q, reason }, paging(page));

  return (
    <>
      <PageHeader title="Movimientos" />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start">
        <LiveSearch placeholder="Artículo, ubicación, documento o usuario" className="w-full max-w-xl" />
        <ReasonFilter options={MOVEMENT_REASONS.map((r) => ({ value: r, label: MOVEMENT_REASON_NAME[r] }))} value={reason ?? ""} />
      </div>
      <h2 className="section-title">
        {q || reason ? "Resultados" : "Todos los movimientos"} <small>{total.toLocaleString("es-AR")}</small>
      </h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="hidden sm:table-cell">Fecha</th>
              <th>Artículo</th>
              <th className="hidden md:table-cell">Motivo</th>
              <th className="hidden sm:table-cell">Origen → Destino</th>
              <th className="text-right">Cantidad</th>
              <th className="hidden lg:table-cell">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow columns={6} title={q || reason ? "Ningún movimiento coincide" : "Todavía no hay movimientos"}>
                {q || reason ? undefined : "Cada recepción, reposición, picking, despacho o baja deja aquí su movimiento."}
              </EmptyRow>
            )}
            {rows.map(({ m, productId, title, fromLoc, toLoc, who }) => (
              <tr key={m.id}>
                <td className="hidden whitespace-nowrap text-muted sm:table-cell">{shortDate(m.createdAt)}</td>
                <td>
                  <Link href={`/stock/${productId}`} className="link">
                    {articleName(title)}
                  </Link>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                    <Place id={m.fromId} code={fromLoc} />
                    <Icon name="arrow" className="size-4 text-muted" />
                    <Place id={m.toId} code={toLoc} />
                  </span>
                  <span className="block text-muted md:hidden">
                    {MOVEMENT_REASON_NAME[m.reason]}
                    {m.reference && ` · ${m.reference}`}
                    <span className="sm:hidden"> · {shortDate(m.createdAt)}</span>
                  </span>
                  <span className="hidden text-muted md:block lg:hidden">{who ?? "—"}</span>
                </td>
                <td className="hidden md:table-cell">
                  {MOVEMENT_REASON_NAME[m.reason]}
                  {m.reference && <span className="text-muted"> · {m.reference}</span>}
                </td>
                <td className="hidden whitespace-nowrap sm:table-cell">
                  <span className="inline-flex items-center gap-1.5">
                    <Place id={m.fromId} code={fromLoc} />
                    <Icon name="arrow" className="size-4 text-muted" />
                    <Place id={m.toId} code={toLoc} />
                  </span>
                </td>
                <td className="text-right font-semibold tabular-nums">{m.quantity}</td>
                <td className="hidden text-muted lg:table-cell">{who ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/movimientos" params={{ q, motivo: reason }} page={page} total={total} />
    </>
  );
}
