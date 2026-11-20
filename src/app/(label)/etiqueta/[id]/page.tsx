import { eq } from "drizzle-orm";
import { carriers } from "@/db/schema";
import { barcodes } from "@/lib/barcodes";
import { requireSession } from "@/lib/session";
import { kilos, orderWithBoxes } from "../../../(print)/imprimir/data";

/** One 100 × 150 mm label per box, for a thermal printer: recipient, box, carrier, tracking and remito. */
export default async function ShippingLabels({ params }: { params: Promise<{ id: string }> }) {
  const { db, company } = await requireSession();
  const d = await orderWithBoxes(db, company.id, Number((await params).id));
  if (d.boxes.length === 0) return <p className="py-10 text-center">Este pedido todavía no tiene cajas cerradas.</p>;
  const [carrier] = d.p.carrierId ? await db.select({ name: carriers.name }).from(carriers).where(eq(carriers.id, d.p.carrierId)) : [];
  return (
    <>
      {d.boxes.map((k) => (
        <div key={k.id} className="flex h-[150mm] w-[100mm] break-after-page flex-col justify-between overflow-hidden border border-black p-[5mm] print:border-0">
          <div>
            <p className="text-[8pt] font-semibold tracking-widest uppercase">Destinatario</p>
            <p className="mt-[1mm] text-[15pt] leading-tight font-bold">{d.customer.name}</p>
            <p className="mt-[1.5mm] text-[11pt] leading-snug">{d.customer.address}</p>
            <p className="text-[11pt] leading-snug">
              {d.customer.city}, {d.customer.province}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-[3mm] border-y-2 border-black py-[3mm] text-[10pt]">
            <div>
              <p className="text-[7pt] font-semibold tracking-widest uppercase">Transporte</p>
              <p className="font-bold">{carrier?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-[7pt] font-semibold tracking-widest uppercase">Remito</p>
              <p className="font-mono font-bold">{d.p.remitoNumber ?? "—"}</p>
            </div>
            {d.p.trackingNumber && (
              <div className="col-span-2">
                <p className="text-[7pt] font-semibold tracking-widest uppercase">Seguimiento</p>
                <div className="h-[12mm] [&>svg]:h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: barcodes(d.p.trackingNumber, 10) }} />
                <p className="font-mono text-[9pt]">{d.p.trackingNumber}</p>
              </div>
            )}
          </div>
          <div className="flex items-end justify-between gap-[3mm]">
            <div>
              <p className="text-[7pt] font-semibold tracking-widest uppercase">Caja</p>
              <p className="text-[28pt] leading-none font-bold">
                {k.number} <span className="text-[13pt] font-semibold">de {d.boxes.length}</span>
              </p>
              <p className="mt-[1mm] text-[10pt]">{kilos(k.weightGrams)} kg</p>
            </div>
            <div className="text-right">
              <div className="ml-auto h-[14mm] w-[48mm] [&>svg]:ml-auto [&>svg]:h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: barcodes(`${d.p.number}-C${k.number}`, 12) }} />
              <p className="mt-[1mm] font-mono text-[9pt] font-bold">
                {d.p.number}-C{k.number} · {company.name}
              </p>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
