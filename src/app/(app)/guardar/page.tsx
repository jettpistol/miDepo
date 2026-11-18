import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Escaneo } from "@/components/Escaneo";
import { Codigo, Encabezado, Vacio } from "@/components/ui";
import { productos, stock, ubicaciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { moverAccion } from "../mover/acciones";

export const metadata = { title: "Guardar" };

export default async function Guardar({ searchParams }: { searchParams: Promise<{ zona?: string }> }) {
  const { db, empresa } = await requerir("operario", "guardar");
  const zona = (await searchParams).zona === "devoluciones" ? "devoluciones" : "recepcion";
  const zonas = await db.select().from(ubicaciones).where(and(eq(ubicaciones.empresaId, empresa.id), inArray(ubicaciones.tipo, ["recepcion", "devoluciones"])));
  const actual = zonas.find((z) => z.tipo === zona);

  const pendientes = actual
    ? await db
        .select({ productoId: stock.productoId, cantidad: stock.cantidad, titulo: productos.titulo, codigo: productos.codigoBarras })
        .from(stock)
        .innerJoin(productos, eq(productos.id, stock.productoId))
        .where(eq(stock.ubicacionId, actual.id))
        .orderBy(asc(productos.titulo))
        .limit(300)
    : [];

  // Sugerencia: el estante donde ese título ya tiene más unidades, para no desparramarlo.
  const sugerencias = new Map<number, string>();
  if (pendientes.length > 0) {
    const donde = await db
      .select({ productoId: stock.productoId, codigo: ubicaciones.codigo })
      .from(stock)
      .innerJoin(ubicaciones, eq(ubicaciones.id, stock.ubicacionId))
      .where(and(eq(stock.empresaId, empresa.id), eq(ubicaciones.tipo, "estanteria"), inArray(stock.productoId, pendientes.map((p) => p.productoId))))
      .orderBy(desc(stock.cantidad));
    for (const d of donde) if (!sugerencias.has(d.productoId)) sugerencias.set(d.productoId, d.codigo);
  }
  const unidades = pendientes.reduce((s, p) => s + p.cantidad, 0);

  return (
    <>
      <Encabezado titulo="Guardar" bajada="Llevá cada título a su estante: escaneá el libro, después el cartel del estante." />
      <div className="mb-4 grid max-w-md grid-cols-2 gap-1 rounded-xl bg-hundido p-1">
        {(["recepcion", "devoluciones"] as const).map((z) => (
          <Link key={z} href={z === "recepcion" ? "/guardar" : "/guardar?zona=devoluciones"} className={`rounded-lg py-2 text-center text-sm font-semibold ${zona === z ? "bg-superficie shadow-sm" : "text-suave"}`}>
            {z === "recepcion" ? "Desde Recepción" : "Desde Devoluciones"}
          </Link>
        ))}
      </div>

      {pendientes.length === 0 ? (
        <Vacio titulo="No queda nada por guardar acá">Lo que cierres en {zona === "recepcion" ? "una recepción" : "una devolución (los libros vendibles)"} va a aparecer en esta lista.</Vacio>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
          <div className="lg:sticky lg:top-6">
            <Escaneo
              accion={moverAccion}
              ocultos={{ origen: actual!.codigo }}
              campos={[
                { nombre: "producto", etiqueta: "Libro" },
                { nombre: "destino", etiqueta: "Estante", ayuda: "Escaneá el cartel del estante" },
              ]}
              cantidad={1}
              boton="Guardar"
            />
          </div>
          <div>
            <p className="mb-2 text-sm text-suave">
              Quedan <strong className="text-texto">{unidades} unidades</strong> de {pendientes.length} títulos.
            </p>
            <div className="tarjeta overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th className="text-right">Por guardar</th>
                    <th>Ya hay en</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((p) => (
                    <tr key={p.productoId}>
                      <td>
                        <span className="block font-medium">{p.titulo}</span>
                        <Codigo>{p.codigo}</Codigo>
                      </td>
                      <td className="text-right text-base font-semibold">{p.cantidad}</td>
                      <td>{sugerencias.has(p.productoId) ? <Codigo>{sugerencias.get(p.productoId)}</Codigo> : <span className="text-suave">Título nuevo: elegí un estante libre</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
