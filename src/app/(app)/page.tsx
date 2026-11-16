import Link from "next/link";
import { and, count, eq, inArray, sum } from "drizzle-orm";
import { Icono } from "@/components/Icono";
import { Encabezado, Tejuelo, Vacio } from "@/components/ui";
import { conteos, devoluciones, pedidos, recepciones, stock, ubicaciones } from "@/db/schema";
import { pendientesDeEnvio } from "@/lib/flujos/envios";
import { puede, requerir } from "@/lib/sesion";
import { EnPreparacion, pedidosAbiertos, Pendientes } from "./picking/Tablas";

/** Una cola de trabajo: qué es, cuánto hay, y a dónde ir. */
function Cola({ href, numero, titulo }: { href: string; numero: number; titulo: string }) {
  return (
    <li>
      <Link href={href} className="fila group">
        <span className="min-w-0 flex-1 font-semibold">{titulo}</span>
        <span className={`text-xl font-bold tabular-nums ${numero > 0 ? "" : "text-suave/60"}`}>{numero}</span>
        <Icono nombre="flecha" className="size-4 text-suave transition-transform duration-150 group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

const PRIMEROS = 8;

export default async function Inicio() {
  const { db, usuario, empresa } = await requerir();
  const e = empresa.id;

  const [abiertos, paraEmpacar, recs, devs, conts, porGuardar, envios] = await Promise.all([
    pedidosAbiertos(db, e),
    db.select({ n: count() }).from(pedidos).where(and(eq(pedidos.empresaId, e), eq(pedidos.estado, "preparado"))),
    db.select({ n: count() }).from(recepciones).where(and(eq(recepciones.empresaId, e), inArray(recepciones.estado, ["pendiente", "en_curso"]))),
    db.select({ n: count() }).from(devoluciones).where(and(eq(devoluciones.empresaId, e), eq(devoluciones.estado, "en_curso"))),
    db.select({ n: count() }).from(conteos).where(and(eq(conteos.empresaId, e), eq(conteos.estado, "abierto"))),
    db.select({ n: sum(stock.cantidad).mapWith(Number) }).from(stock).innerJoin(ubicaciones, eq(ubicaciones.id, stock.ubicacionId)).where(and(eq(stock.empresaId, e), inArray(ubicaciones.tipo, ["recepcion", "devoluciones"]))),
    puede(usuario.rol, "supervisor") ? pendientesDeEnvio(db, e) : Promise.resolve([]),
  ]);
  const { enCurso, pendientes } = abiertos;
  const mios = enCurso.filter((f) => f.p.tomadoPor === usuario.id);

  return (
    <>
      <Encabezado titulo={`Hola, ${usuario.nombre.split(" ")[0]}`} />

      {mios.map(({ p, proximo }) => (
        <Link key={p.id} href={`/picking/${p.id}`} className="mb-6 flex items-center gap-4 rounded-control bg-acento px-4 py-3.5 text-sobre-acento transition-colors duration-150 hover:bg-acento-vivo">
          {proximo && <Tejuelo codigo={proximo} tam="md" sobreAcento />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm opacity-85">Tenés un pedido a medio preparar</span>
            <span className="block text-lg leading-tight font-bold">Seguir con {p.numero}</span>
          </span>
          <Icono nombre="flecha" className="size-6" />
        </Link>
      ))}

      <div className="grid gap-x-12 gap-y-9 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-9">
          {enCurso.length > 0 && (
            <section>
              <h2 className="titulo-seccion">
                Pedidos en preparación <small>{enCurso.length}</small>
              </h2>
              <EnPreparacion filas={enCurso} usuarioId={usuario.id} />
            </section>
          )}

          <section>
            <h2 className="titulo-seccion">
              Pedidos para preparar <small>{pendientes.length}</small>
            </h2>
            {pendientes.length === 0 ? (
              <Vacio titulo="No hay pedidos pendientes">Los pedidos nuevos aparecen cuando se sincroniza con Fierro.</Vacio>
            ) : (
              <>
                <Pendientes filas={pendientes.slice(0, PRIMEROS)} />
                {pendientes.length > PRIMEROS && (
                  <p className="mt-3 text-sm text-suave">
                    Los {PRIMEROS} más viejos de {pendientes.length}.{" "}
                    <Link href="/picking" className="enlace">
                      Ver todos en Picking
                    </Link>
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <section>
          <h2 className="titulo-seccion">El resto del depósito</h2>
          <ul className="lista">
            <Cola href="/empaque" numero={paraEmpacar[0].n} titulo="Pedidos para empacar" />
            <Cola href="/recepcion" numero={recs[0].n} titulo="Recepciones abiertas" />
            <Cola href="/guardar" numero={porGuardar[0].n ?? 0} titulo="Unidades por guardar" />
            <Cola href="/devoluciones" numero={devs[0].n} titulo="Devoluciones en curso" />
            <Cola href="/conteos" numero={conts[0].n} titulo="Conteos abiertos" />
            {puede(usuario.rol, "supervisor") && <Cola href="/fierro" numero={envios.length} titulo="Para cargar en Fierro" />}
          </ul>
        </section>
      </div>
    </>
  );
}
