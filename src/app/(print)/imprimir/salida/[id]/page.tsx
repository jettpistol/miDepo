import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { locations, transfers } from "@/db/schema";
import { articleName } from "@/lib/article";
import { fierroCode } from "@/lib/fierro/csv";
import { transferLinesOf } from "@/lib/flows/transfers";
import { requireSession } from "@/lib/session";

/** What a transfer takes out: the list to issue its remito in Fierro and to check at the destination. */
export default async function TransferList({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company } = await requireSession();
  const [row] = await db.select({ t: transfers, place: locations }).from(transfers).innerJoin(locations, eq(locations.id, transfers.locationId)).where(and(eq(transfers.id, id), eq(transfers.companyId, company.id)));
  if (!row) notFound();
  const lines = await transferLinesOf(db, id);
  const total = lines.reduce((s, x) => s + x.l.sent, 0);
  return (
    <div className="text-[10pt]">
      <div className="mb-[6mm] flex items-end justify-between border-b-2 border-black pb-[3mm]">
        <div>
          <p className="text-[9pt] font-semibold tracking-widest uppercase">Salida · {company.name}</p>
          <p className="text-[18pt] font-bold">{row.t.number}</p>
        </div>
        <div className="text-right">
          <p className="text-[13pt] font-bold">{row.place.name ?? row.place.code}</p>
          <p className="font-mono">{row.place.code}</p>
          {row.t.remitoNumber && <p className="font-mono">Remito {row.t.remitoNumber}</p>}
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-[1.5mm]">Código</th>
            <th>Artículo</th>
            <th className="text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(({ l, title, sku, isbn }) => (
            <tr key={l.id} className="border-b border-black/30">
              <td className="py-[1.2mm] pr-[3mm] font-mono">{fierroCode({ isbn, internalCode: sku })}</td>
              <td>{articleName(title)}</td>
              <td className="text-right font-bold tabular-nums">{l.sent}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="pt-[2mm] text-right font-semibold">
              Total
            </td>
            <td className="pt-[2mm] text-right font-bold tabular-nums">{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
