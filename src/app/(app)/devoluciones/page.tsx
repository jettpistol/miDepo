import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Formulario } from "@/components/Escaneo";
import { Encabezado, fechaCorta, Insignia, plural } from "@/components/ui";
import { clientes, devolucionLineas, devoluciones } from "@/db/schema";
import { requerir } from "@/lib/sesion";
import { crear } from "./acciones";

export const metadata = { title: "Devoluciones" };

export default async function Devoluciones() {
  const { db, empresa } = await requerir();
  const [lista, filas] = await Promise.all([
    db.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes).where(eq(clientes.empresaId, empresa.id)).orderBy(asc(clientes.nombre)),
    db
      .select({ d: devoluciones, cliente: clientes.nombre, unidades: sql<number>`coalesce(sum(${devolucionLineas.cantidad}), 0)`.mapWith(Number) })
      .from(devoluciones)
      .innerJoin(clientes, eq(clientes.id, devoluciones.clienteId))
      .leftJoin(devolucionLineas, eq(devolucionLineas.devolucionId, devoluciones.id))
      .where(eq(devoluciones.empresaId, empresa.id))
      .groupBy(devoluciones.id, clientes.nombre)
      .orderBy(desc(devoluciones.fecha))
      .limit(40),
  ]);

  return (
    <>
      <Encabezado titulo="Devoluciones" bajada="Revisá cada libro que vuelve y decidí si se puede vender, si va a saldo o si está dañado." />
      <section className="tarjeta mb-6 p-4">
        <h2 className="mb-3 font-semibold">Llegó una devolución</h2>
        <Formulario accion={crear} boton="Empezar a revisar" clase="flex flex-wrap items-start gap-3">
          <select name="clienteId" className="campo max-w-md flex-1" aria-label="Cliente que devuelve" required defaultValue="">
            <option value="" disabled>
              ¿Quién devuelve?
            </option>
            {lista.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Formulario>
      </section>

      {filas.length > 0 && (
        <ul className="space-y-2">
          {filas.map(({ d, cliente, unidades }) => (
            <li key={d.id}>
              <Link href={`/devoluciones/${d.id}`} className="tarjeta flex flex-wrap items-center justify-between gap-2 p-4 hover:border-acento-texto/50">
                <span>
                  <span className="block font-semibold">
                    {d.numero} · {cliente}
                  </span>
                  <span className="block text-sm text-suave">
                    {plural(unidades, "unidad", "unidades")} · {fechaCorta(d.fecha)}
                  </span>
                </span>
                {d.estado === "en_curso" ? <Insignia tono="acento">En curso</Insignia> : <Insignia tono="ok">Cerrada</Insignia>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
