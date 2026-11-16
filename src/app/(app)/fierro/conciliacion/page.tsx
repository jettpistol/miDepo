import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { Aviso, Codigo, Encabezado, Vacio } from "@/components/ui";
import { fierroStock, productos, stock } from "@/db/schema";
import { pendientesDeEnvio } from "@/lib/flujos/envios";
import { requerir } from "@/lib/sesion";

export const metadata = { title: "Conciliación con Fierro" };

export default async function Conciliacion() {
  const { db, empresa } = await requerir("supervisor");
  const fisico = db.select({ productoId: stock.productoId, total: sql<number>`sum(${stock.cantidad})`.as("total") }).from(stock).where(eq(stock.empresaId, empresa.id)).groupBy(stock.productoId).as("fisico");
  const enDeposito = sql<number>`coalesce(${fisico.total}, 0)`;
  const enFierro = sql<number>`coalesce(${fierroStock.cantidad}, 0)`;
  const filas = await db
    .select({ id: productos.id, titulo: productos.titulo, codigo: productos.codigoBarras, deposito: enDeposito.mapWith(Number), fierro: enFierro.mapWith(Number) })
    .from(productos)
    .leftJoin(fierroStock, and(eq(fierroStock.productoId, productos.id), eq(fierroStock.empresaId, empresa.id)))
    .leftJoin(fisico, eq(fisico.productoId, productos.id))
    .where(and(eq(productos.empresaId, empresa.id), sql`${enDeposito} <> ${enFierro}`))
    .orderBy(sql`abs(${enDeposito} - ${enFierro}) desc`, productos.titulo)
    .limit(300);
  const sinEnviar = (await pendientesDeEnvio(db, empresa.id)).length;

  return (
    <>
      <Encabezado titulo="Conciliación con Fierro" volver={{ href: "/fierro", texto: "Fierro" }} />
      {sinEnviar > 0 && (
        <div className="mb-6">
          <Aviso tono="alerta">
            Hay {sinEnviar} {sinEnviar === 1 ? "documento sin cargar" : "documentos sin cargar"} en Fierro. Parte de estas diferencias se van a ir cuando los cargues.{" "}
            <Link href="/fierro" className="font-semibold underline underline-offset-[3px]">
              Ver pendientes
            </Link>
          </Aviso>
        </div>
      )}
      {filas.length === 0 ? (
        <Vacio titulo="El depósito y Fierro dicen lo mismo">No hay ninguna diferencia de stock.</Vacio>
      ) : (
        <>
          <p className="mb-3 max-w-[70ch] text-sm text-suave">
            {filas.length === 300 ? "Las 300 diferencias más grandes" : `${filas.length} títulos con diferencia`}
          </p>
          <div className="overflow-x-auto border-y border-borde">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Título</th>
                  <th className="hidden sm:table-cell">Código</th>
                  <th className="hidden text-right sm:table-cell">Depósito</th>
                  <th className="hidden text-right sm:table-cell">Fierro</th>
                  <th className="text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/stock/${f.id}`} className="enlace">
                        {f.titulo}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-suave sm:hidden">
                        <Codigo>{f.codigo}</Codigo>
                        <span>
                          Depósito {f.deposito} · Fierro {f.fierro}
                        </span>
                      </span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <Codigo>{f.codigo}</Codigo>
                    </td>
                    <td className="hidden text-right sm:table-cell">{f.deposito}</td>
                    <td className="hidden text-right sm:table-cell">{f.fierro}</td>
                    <td className={`text-right font-semibold ${f.deposito < f.fierro ? "text-peligro" : "text-ok"}`}>
                      {f.deposito > f.fierro ? "+" : ""}
                      {f.deposito - f.fierro}
                    </td>
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
