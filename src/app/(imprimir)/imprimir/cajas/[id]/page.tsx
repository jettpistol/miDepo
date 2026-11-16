import { barras } from "@/lib/barras";
import { requerir } from "@/lib/sesion";
import { kilos, pedidoConCajas } from "../../datos";

/** Una etiqueta grande por caja: cuatro por hoja A4, para pegar con cinta. */
export default async function EtiquetasCajas({ params }: { params: Promise<{ id: string }> }) {
  const { db, empresa } = await requerir();
  const d = await pedidoConCajas(db, empresa.id, Number((await params).id));
  if (d.cajas.length === 0) return <p className="py-10 text-center">Este pedido todavía no tiene cajas cerradas.</p>;
  return (
    <div className="grid grid-cols-2 gap-[4mm]">
      {d.cajas.map((k) => (
        <div key={k.id} className="flex h-[136mm] break-inside-avoid flex-col justify-between rounded-[3mm] border-2 border-black p-[6mm]">
          <div>
            <p className="text-[9pt] font-semibold tracking-widest uppercase">Destinatario</p>
            <p className="mt-[1mm] text-[17pt] leading-tight font-bold">{d.cliente.nombre}</p>
            <p className="mt-[2mm] text-[12pt]">{d.cliente.direccion}</p>
            <p className="text-[12pt]">
              {d.cliente.localidad}, {d.cliente.provincia}
            </p>
          </div>
          <div className="flex items-end justify-between gap-[4mm] border-t-2 border-black pt-[4mm]">
            <div>
              <p className="text-[9pt] font-semibold tracking-widest uppercase">Caja</p>
              <p className="text-[34pt] leading-none font-bold">
                {k.numero} <span className="text-[16pt] font-semibold">de {d.cajas.length}</span>
              </p>
              <p className="mt-[2mm] text-[11pt]">{kilos(k.pesoGramos)} kg</p>
            </div>
            <div className="text-right">
              <div className="ml-auto h-[16mm] w-[60mm] [&>svg]:ml-auto [&>svg]:h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: barras(`${d.p.numero}-C${k.numero}`, 14) }} />
              <p className="mt-[1mm] font-mono text-[11pt] font-bold">
                {d.p.numero} · {empresa.nombre}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
