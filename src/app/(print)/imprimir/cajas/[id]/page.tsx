import { barcodes } from "@/lib/barcodes";
import { requireSession } from "@/lib/session";
import { kilos, orderWithBoxes } from "../../data";

/** One large label per box: four per A4 page, to be taped on. */
export default async function BoxLabels({ params }: { params: Promise<{ id: string }> }) {
  const { db, company } = await requireSession();
  const d = await orderWithBoxes(db, company.id, Number((await params).id));
  if (d.boxes.length === 0) return <p className="py-10 text-center">Este pedido todavía no tiene cajas cerradas.</p>;
  return (
    <div className="grid grid-cols-2 gap-[4mm]">
      {d.boxes.map((k) => (
        <div key={k.id} className="flex h-[136mm] break-inside-avoid flex-col justify-between rounded-[3mm] border-2 border-black p-[6mm]">
          <div>
            <p className="text-[9pt] font-semibold tracking-widest uppercase">Destinatario</p>
            <p className="mt-[1mm] text-[17pt] leading-tight font-bold">{d.customer.name}</p>
            <p className="mt-[2mm] text-[12pt]">{d.customer.address}</p>
            <p className="text-[12pt]">
              {d.customer.city}, {d.customer.province}
            </p>
          </div>
          <div className="flex items-end justify-between gap-[4mm] border-t-2 border-black pt-[4mm]">
            <div>
              <p className="text-[9pt] font-semibold tracking-widest uppercase">Caja</p>
              <p className="text-[34pt] leading-none font-bold">
                {k.number} <span className="text-[16pt] font-semibold">de {d.boxes.length}</span>
              </p>
              <p className="mt-[2mm] text-[11pt]">{kilos(k.weightGrams)} kg</p>
            </div>
            <div className="text-right">
              <div className="ml-auto h-[16mm] w-[60mm] [&>svg]:ml-auto [&>svg]:h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: barcodes(`${d.p.number}-C${k.number}`, 14) }} />
              <p className="mt-[1mm] font-mono text-[11pt] font-bold">
                {d.p.number} · {company.name}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
