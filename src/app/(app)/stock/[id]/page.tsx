import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Codigo, Encabezado, fechaCorta, Insignia } from "@/components/ui";
import { fierroStock, movimientos, productos, stock, ubicaciones, usuarios } from "@/db/schema";
import { moduloActivo } from "@/lib/modulos";
import { resumenStock } from "@/lib/reservas";
import { requerir } from "@/lib/sesion";
import { nombreUbicacion } from "@/lib/stock";

const MOTIVO = { inicial: "Carga inicial", recepcion: "Recepción", guardado: "Guardado", movimiento: "Movimiento", picking: "Picking", despacho: "Despacho", devolucion: "Devolución", ajuste_conteo: "Ajuste por conteo" } as const;

export default async function Producto({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, empresa } = await requerir();
  const [p] = await db.select().from(productos).where(and(eq(productos.id, id), eq(productos.empresaId, empresa.id)));
  if (!p) notFound();
  const desde = alias(ubicaciones, "desde");
  const hacia = alias(ubicaciones, "hacia");
  const [donde, [fierro], movs] = await Promise.all([
    db.select({ s: stock, u: ubicaciones }).from(stock).innerJoin(ubicaciones, eq(ubicaciones.id, stock.ubicacionId)).where(eq(stock.productoId, id)).orderBy(asc(ubicaciones.codigo)),
    db.select().from(fierroStock).where(eq(fierroStock.productoId, id)),
    db
      .select({ m: movimientos, desde: desde.codigo, hacia: hacia.codigo, quien: usuarios.nombre })
      .from(movimientos)
      .leftJoin(desde, eq(desde.id, movimientos.desdeId))
      .leftJoin(hacia, eq(hacia.id, movimientos.haciaId))
      .leftJoin(usuarios, eq(usuarios.id, movimientos.usuarioId))
      .where(eq(movimientos.productoId, id))
      .orderBy(desc(movimientos.id))
      .limit(30),
  ]);
  const total = donde.reduce((s, d) => s + d.s.cantidad, 0);
  const r = (await resumenStock(db, empresa.id, [id])).get(id)!;
  const sobrecomprometido = r.disponible < 0;

  return (
    <>
      <Encabezado titulo={p.titulo} volver={{ href: "/stock", texto: "Stock" }} bajada={[p.autor, p.sello].filter(Boolean).join(" · ")} />
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["En el depósito", total, "Todo lo que hay en el edificio"],
          ["Comprometido", r.comprometido, "Apartado para pedidos sin preparar"],
          ["Disponible", r.disponible, "En estantería, sin apartar: lo que se puede prometer"],
          ...(moduloActivo(empresa, "fierro") ? [["Según Fierro", fierro?.cantidad ?? 0, "Lo que cree Fierro"] as const] : []),
        ].map(([k, v, ayuda]) => (
          <div key={k} className="tarjeta p-4" title={ayuda as string}>
            <dt className="text-sm text-suave">{k}</dt>
            <dd className={`text-3xl font-bold tabular-nums ${k === "Disponible" && sobrecomprometido ? "text-peligro" : ""}`}>{v}</dd>
          </div>
        ))}
        <div className="tarjeta col-span-2 p-4 text-sm">
          <dt className="text-suave">Códigos</dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            <Codigo>{p.codigoBarras}</Codigo>
            {p.isbn && p.codigoInterno !== p.codigoBarras && <Codigo>{p.codigoInterno}</Codigo>}
            {!p.isbn && <Insignia tono="alerta">Sin ISBN</Insignia>}
          </dd>
        </div>
      </dl>

      {sobrecomprometido && (
        <p className="mb-5 rounded-xl bg-peligro-suave px-4 py-3 text-sm font-semibold text-peligro">
          Hay {r.comprometido} unidades apartadas para pedidos y solo {r.vendible} en estantería. Alguien sacó stock que estaba prometido (por ejemplo, un libro dañado). Conviene contar este título.
        </p>
      )}

      <h2 className="mb-2 text-sm font-semibold text-suave">Dónde está</h2>
      {donde.length === 0 ? (
        <p className="tarjeta p-5 text-sm text-suave">No hay unidades en el depósito.</p>
      ) : (
        <ul className="tarjeta divide-y divide-borde/70">
          {donde.map(({ s, u }) => (
            <li key={u.id}>
              <Link href={`/ubicaciones/${u.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-hundido">
                <span className="font-mono text-lg font-bold">{u.tipo === "estanteria" ? u.codigo : nombreUbicacion(u)}</span>
                <span className="text-xl font-bold tabular-nums">{s.cantidad}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {movs.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold text-suave">Últimos movimientos</h2>
          <div className="tarjeta overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Qué</th>
                  <th>Desde → Hacia</th>
                  <th className="text-right">Cantidad</th>
                  <th>Quién</th>
                </tr>
              </thead>
              <tbody>
                {movs.map(({ m, desde, hacia, quien }) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-suave">{fechaCorta(m.creado)}</td>
                    <td>
                      {MOTIVO[m.motivo]}
                      {m.referencia && <span className="text-suave"> · {m.referencia}</span>}
                    </td>
                    <td className="font-mono text-[13px] whitespace-nowrap">
                      {desde ?? "afuera"} → {hacia ?? "afuera"}
                    </td>
                    <td className="text-right font-semibold">{m.cantidad}</td>
                    <td className="text-suave">{quien ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
