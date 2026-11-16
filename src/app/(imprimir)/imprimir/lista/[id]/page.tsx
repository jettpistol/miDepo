import { requerir } from "@/lib/sesion";
import { kilos, pedidoConCajas } from "../../datos";

/** Lista de empaque del pedido. No es un remito: el remito lo emite Fierro. */
export default async function ListaDeEmpaque({ params }: { params: Promise<{ id: string }> }) {
  const { db, empresa } = await requerir();
  const d = await pedidoConCajas(db, empresa.id, Number((await params).id));
  const faltantes = d.lineas.filter((x) => x.l.pickeado < x.l.cantidad);
  const unidades = d.items.reduce((s, i) => s + i.cantidad, 0);
  return (
    <article className="text-[10.5pt] leading-snug">
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-[4mm]">
        <div>
          <p className="text-[9pt] font-semibold tracking-widest uppercase">Lista de empaque</p>
          <h1 className="text-[20pt] font-bold">Pedido {d.p.numero}</h1>
          <p>{empresa.nombre}</p>
        </div>
        <div className="text-right">
          <p className="font-bold">{d.cliente.nombre}</p>
          <p>{d.cliente.direccion}</p>
          <p>
            {d.cliente.localidad}, {d.cliente.provincia}
          </p>
          <p className="mt-[1mm]">{d.p.modalidad === "consignacion" ? "En consignación" : "En firme"}</p>
        </div>
      </header>
      <p className="my-[4mm]">
        <strong>
          {d.cajas.length} {d.cajas.length === 1 ? "caja" : "cajas"} · {unidades} unidades · {kilos(d.cajas.reduce((s, k) => s + (k.pesoGramos ?? 0), 0))} kg
        </strong>
      </p>
      {d.cajas.map((k) => (
        <section key={k.id} className="mb-[5mm] break-inside-avoid">
          <h2 className="border-b border-black pb-[1mm] font-bold">
            Caja {k.numero} · {kilos(k.pesoGramos)} kg
          </h2>
          <table className="w-full">
            <tbody>
              {d.items.filter((i) => i.cajaId === k.id).map((i) => (
                <tr key={i.codigo} className="border-b border-neutral-300">
                  <td className="w-[38mm] py-[1mm] font-mono text-[9pt]">{i.codigo}</td>
                  <td className="py-[1mm]">{i.titulo}</td>
                  <td className="w-[14mm] py-[1mm] text-right font-bold">{i.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {faltantes.length > 0 && (
        <section className="break-inside-avoid border-2 border-black p-[3mm]">
          <h2 className="font-bold">No se envía en este pedido</h2>
          <ul>
            {faltantes.map((x) => (
              <li key={x.l.id}>
                {x.l.cantidad - x.l.pickeado} × {x.titulo}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-[6mm] text-[8.5pt]">Documento interno del depósito. No reemplaza al remito ni a la factura.</p>
    </article>
  );
}
