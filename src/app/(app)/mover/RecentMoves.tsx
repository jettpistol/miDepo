import { ActionButton } from "@/components/ScanForm";
import { ShelfMark, shortDate } from "@/components/ui";
import type { DB } from "@/db";
import { recentMoves } from "@/lib/flows/move";
import { articleName } from "@/lib/article";
import { undoMoveAction } from "./actions";

/** This person's latest moves and put-aways, each with "Deshacer" while it has not been undone. */
export async function RecentMoves({ db, companyId, userId }: { db: DB; companyId: number; userId: number }) {
  const rows = await recentMoves(db, companyId, userId);
  if (rows.length === 0) return null;
  return (
    <section className="mt-8 lg:mt-6">
      <h2 className="section-title">Tus últimos movimientos</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Artículo</th>
              <th className="hidden sm:table-cell">Origen → destino</th>
              <th className="text-right">Cantidad</th>
              <th className="hidden md:table-cell">Fecha</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={m.undone ? "text-muted" : ""}>
                <td className="max-w-0 w-full">
                  <span className="block truncate font-medium">{articleName(m.title)}</span>
                  <span className="mt-1 flex items-center gap-1.5 sm:hidden">
                    <ShelfMark code={m.from} /> → <ShelfMark code={m.to} />
                  </span>
                </td>
                <td className="hidden whitespace-nowrap sm:table-cell">
                  <span className="flex items-center gap-1.5">
                    <ShelfMark code={m.from} /> → <ShelfMark code={m.to} />
                  </span>
                </td>
                <td className="text-right font-semibold tabular-nums">{m.quantity}</td>
                <td className="hidden whitespace-nowrap text-muted md:table-cell">{shortDate(m.date)}</td>
                <td className="w-px text-right whitespace-nowrap">
                  {m.undone ? (
                    <span className="text-sm">Deshecho</span>
                  ) : (
                    <ActionButton action={undoMoveAction} hiddenFields={{ id: m.id }} className="btn-sm" showOk={false} confirm={`¿Deshacer? ${m.quantity} × ${articleName(m.title)} vuelve de ${m.to} a ${m.from}.`}>
                      Deshacer
                    </ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
