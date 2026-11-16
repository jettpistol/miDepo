import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Icono } from "@/components/Icono";
import { Codigo, Encabezado, fechaCorta, Insignia, Tejuelo } from "@/components/ui";
import { fierroStock, movimientos, productos, stock, ubicaciones, usuarios } from "@/db/schema";
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

  return (
    <>
      <Encabezado titulo={p.titulo} volver={{ href: "/stock", texto: "Stock" }} bajada={[p.autor, p.sello].filter(Boolean).join(" · ")} />
      <dl className="mb-9 flex flex-wrap items-end gap-x-10 gap-y-3 border-y border-borde px-2 py-3 lg:px-3">
        {[
          ["En el depósito", total],
          ["Según Fierro", fierro?.cantidad ?? 0],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm text-suave">{k}</dt>
            <dd className="text-xl font-bold tabular-nums">{v}</dd>
          </div>
        ))}
        <div>
          <dt className="text-sm text-suave">Códigos</dt>
          <dd className="flex min-h-7 flex-wrap items-center gap-2">
            <Codigo>{p.codigoBarras}</Codigo>
            {p.isbn && p.codigoInterno !== p.codigoBarras && <Codigo>{p.codigoInterno}</Codigo>}
            {!p.isbn && <Insignia tono="alerta">Sin ISBN</Insignia>}
          </dd>
        </div>
      </dl>

      <div className="grid gap-x-12 gap-y-9 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <section>
          <h2 className="titulo-seccion">
            Dónde está {donde.length > 0 && <small>{donde.length}</small>}
          </h2>
          {donde.length === 0 ? (
            <p className="border-y border-borde px-2 py-6 text-sm text-suave lg:px-3">No hay unidades en el depósito.</p>
          ) : (
            <ul className="lista">
              {donde.map(({ s, u }) => (
                <li key={u.id}>
                  <Link href={`/ubicaciones/${u.id}`} className="fila">
                    <Tejuelo codigo={u.codigo} tam="md" />
                    <span className="min-w-0 flex-1 truncate text-sm text-suave">{u.tipo === "estanteria" ? "" : nombreUbicacion(u)}</span>
                    <span className="text-xl font-bold tabular-nums">{s.cantidad}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {movs.length > 0 && (
          <section className="min-w-0">
            <h2 className="titulo-seccion">Últimos movimientos</h2>
            <div className="overflow-x-auto border-y border-borde">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="hidden sm:table-cell">Cuándo</th>
                    <th>Qué</th>
                    <th>Desde → Hacia</th>
                    <th className="text-right">Cantidad</th>
                    <th className="hidden md:table-cell">Quién</th>
                  </tr>
                </thead>
                <tbody>
                  {movs.map(({ m, desde, hacia, quien }) => (
                    <tr key={m.id}>
                      <td className="hidden whitespace-nowrap text-suave sm:table-cell">{fechaCorta(m.creado)}</td>
                      <td>
                        {MOTIVO[m.motivo]}
                        {m.referencia && <span className="text-suave"> · {m.referencia}</span>}
                        <span className="block text-suave sm:hidden">{fechaCorta(m.creado)}</span>
                        <span className="hidden text-suave sm:block md:hidden">{quien ?? "—"}</span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {desde ? <Tejuelo codigo={desde} /> : <span className="text-suave">afuera</span>}
                          <Icono nombre="flecha" className="size-4 text-suave" />
                          {hacia ? <Tejuelo codigo={hacia} /> : <span className="text-suave">afuera</span>}
                        </span>
                      </td>
                      <td className="text-right font-semibold">{m.cantidad}</td>
                      <td className="hidden text-suave md:table-cell">{quien ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
