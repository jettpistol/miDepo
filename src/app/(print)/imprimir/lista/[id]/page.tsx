import { requireSession } from "@/lib/session";
import { kilos, orderWithBoxes } from "../../data";
import { articleName } from "@/lib/article";

/** Packing list for the order. It is not a delivery note (remito): Fierro issues that. */
export default async function PackingList({ params }: { params: Promise<{ id: string }> }) {
  const { db, company } = await requireSession();
  const d = await orderWithBoxes(db, company.id, Number((await params).id));
  const shortages = d.lines.filter((x) => x.l.picked < x.l.quantity);
  const units = d.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <article className="text-[10.5pt] leading-snug">
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-[4mm]">
        <div>
          <p className="text-[9pt] font-semibold tracking-widest uppercase">Lista de empaque</p>
          <h1 className="text-[20pt] font-bold">Pedido {d.p.number}</h1>
          <p>{company.name}</p>
        </div>
        <div className="text-right">
          <p className="font-bold">{d.customer.name}</p>
          <p>{d.customer.address}</p>
          <p>
            {d.customer.city}, {d.customer.province}
          </p>
          <p className="mt-[1mm]">{d.p.saleMode === "consignment" ? "En consignación" : "En firme"}</p>
        </div>
      </header>
      <p className="my-[4mm]">
        <strong>
          {d.boxes.length} {d.boxes.length === 1 ? "caja" : "cajas"} · {units} unidades · {kilos(d.boxes.reduce((s, k) => s + (k.weightGrams ?? 0), 0))} kg
        </strong>
      </p>
      {d.boxes.map((k) => (
        <section key={k.id} className="mb-[5mm] break-inside-avoid">
          <h2 className="border-b border-black pb-[1mm] font-bold">
            Caja {k.number} · {kilos(k.weightGrams)} kg
          </h2>
          <table className="w-full">
            <tbody>
              {d.items.filter((i) => i.boxId === k.id).map((i) => (
                <tr key={i.code} className="border-b border-neutral-300">
                  <td className="w-[38mm] py-[1mm] font-mono text-[9pt]">{i.code}</td>
                  <td className="py-[1mm]">{articleName(i.title)}</td>
                  <td className="w-[14mm] py-[1mm] text-right font-bold">{i.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {shortages.length > 0 && (
        <section className="break-inside-avoid border-2 border-black p-[3mm]">
          <h2 className="font-bold">No se envía en este pedido</h2>
          <ul>
            {shortages.map((x) => (
              <li key={x.l.id}>
                {x.l.quantity - x.l.picked} × {articleName(x.title)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-[6mm] text-[8.5pt]">Documento interno del depósito. No reemplaza a la remito ni a la factura.</p>
    </article>
  );
}
