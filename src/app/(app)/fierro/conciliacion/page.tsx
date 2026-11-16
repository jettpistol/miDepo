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
      <Encabezado titulo="Conciliación con Fierro" volver={{ href: "/fierro", texto: "Fierro" }} bajada="Títulos donde lo que hay en el depósito no coincide con lo que dice Fierro." />
      {sinEnviar > 0 && (
        <div className="mb-4">
          <Aviso tono="alerta">
            Hay {sinEnviar} {sinEnviar === 1 ? "documento sin cargar" : "documentos sin cargar"} en Fierro. Parte de estas diferencias se van a ir cuando los cargues.{" "}
            <Link href="/fierro" className="underline">
              Ver pendientes
            </Link>
          </Aviso>
        </div>
      )}
      {filas.length === 0 ? (
        <Vacio titulo="El depósito y Fierro dicen lo mismo">No hay ninguna diferencia de stock.</Vacio>
      ) : (
        <>
          <p className="mb-2 text-sm text-suave">
            {filas.length === 300 ? "Las 300 diferencias más grandes" : `${filas.length} títulos con diferencia`}. Para resolver una: contá el título en el depósito y, si el depósito tiene razón, corregí el stock en Fierro.
          </p>
          <div className="tarjeta overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Título</th>
                  <th className="text-right">Depósito</th>
                  <th className="text-right">Fierro</th>
                  <th className="text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/stock/${f.id}`} className="block font-medium hover:underline">
                        {f.titulo}
                      </Link>
                      <Codigo>{f.codigo}</Codigo>
                    </td>
                    <td className="text-right">{f.deposito}</td>
                    <td className="text-right">{f.fierro}</td>
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
