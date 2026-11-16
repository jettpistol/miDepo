import Link from "next/link";
import { and, count, eq, inArray, sum } from "drizzle-orm";
import { Icono, type NombreIcono } from "@/components/Icono";
import { Encabezado } from "@/components/ui";
import { conteos, devoluciones, pedidos, recepciones, stock, ubicaciones } from "@/db/schema";
import { pendientesDeEnvio } from "@/lib/flujos/envios";
import { puede, requerir } from "@/lib/sesion";

function Tarea({ href, icono, numero, titulo, detalle, destacada = false }: { href: string; icono: NombreIcono; numero: number; titulo: string; detalle: string; destacada?: boolean }) {
  const hay = numero > 0;
  return (
    <Link href={href} className={`tarjeta group flex items-center gap-4 p-4 transition hover:border-acento-texto/50 ${destacada && hay ? "border-acento-texto/40 bg-acento-suave" : ""}`}>
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${hay ? "bg-acento text-sobre-acento" : "bg-hundido text-suave"}`}>
        <Icono nombre={icono} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{titulo}</span>
        <span className="block truncate text-sm text-suave">{detalle}</span>
      </span>
      <span className={`text-3xl font-bold tabular-nums ${hay ? "" : "text-suave/50"}`}>{numero}</span>
    </Link>
  );
}

export default async function Inicio() {
  const { db, usuario, empresa } = await requerir();
  const e = empresa.id;
  const cuenta = async (tabla: typeof pedidos, estado: (typeof pedidos.$inferSelect)["estado"]) => (await db.select({ n: count() }).from(tabla).where(and(eq(tabla.empresaId, e), eq(tabla.estado, estado))))[0].n;

  const [pendientes, paraEmpacar, mios, recs, devs, conts, porGuardar, envios] = await Promise.all([
    cuenta(pedidos, "pendiente"),
    cuenta(pedidos, "preparado"),
    db.select({ id: pedidos.id, numero: pedidos.numero }).from(pedidos).where(and(eq(pedidos.empresaId, e), eq(pedidos.estado, "en_preparacion"), eq(pedidos.tomadoPor, usuario.id))),
    db.select({ n: count() }).from(recepciones).where(and(eq(recepciones.empresaId, e), inArray(recepciones.estado, ["pendiente", "en_curso"]))),
    db.select({ n: count() }).from(devoluciones).where(and(eq(devoluciones.empresaId, e), eq(devoluciones.estado, "en_curso"))),
    db.select({ n: count() }).from(conteos).where(and(eq(conteos.empresaId, e), eq(conteos.estado, "abierto"))),
    db.select({ n: sum(stock.cantidad).mapWith(Number) }).from(stock).innerJoin(ubicaciones, eq(ubicaciones.id, stock.ubicacionId)).where(and(eq(stock.empresaId, e), inArray(ubicaciones.tipo, ["recepcion", "devoluciones"]))),
    puede(usuario.rol, "supervisor") ? pendientesDeEnvio(db, e) : Promise.resolve([]),
  ]);

  return (
    <>
      <Encabezado titulo={`Hola, ${usuario.nombre.split(" ")[0]}`} bajada="Esto es lo que hay para hacer en el depósito ahora." />

      {mios.length > 0 && (
        <div className="mb-5 space-y-2">
          {mios.map((p) => (
            <Link key={p.id} href={`/picking/${p.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-acento px-5 py-4 text-sobre-acento">
              <span>
                <span className="block text-sm opacity-80">Tenés un pedido a medio preparar</span>
                <span className="block text-lg font-bold">Seguir con {p.numero}</span>
              </span>
              <Icono nombre="flecha" className="size-6" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Tarea href="/picking" icono="picking" numero={pendientes} titulo="Pedidos para preparar" detalle="Llegaron de Fierro y nadie los tomó" destacada />
        <Tarea href="/empaque" icono="empaque" numero={paraEmpacar} titulo="Pedidos para empacar" detalle="Ya preparados, falta armar las cajas" />
        <Tarea href="/recepcion" icono="recepcion" numero={recs[0].n} titulo="Recepciones abiertas" detalle="Mercadería por contar" />
        <Tarea href="/guardar" icono="guardar" numero={porGuardar[0].n ?? 0} titulo="Unidades por guardar" detalle="Esperan en Recepción o Devoluciones" />
        <Tarea href="/devoluciones" icono="devolucion" numero={devs[0].n} titulo="Devoluciones en curso" detalle="Libros que volvieron y hay que revisar" />
        <Tarea href="/conteos" icono="conteo" numero={conts[0].n} titulo="Conteos abiertos" detalle="Ubicaciones por contar" />
        {puede(usuario.rol, "supervisor") && <Tarea href="/fierro" icono="fierro" numero={envios.length} titulo="Para cargar en Fierro" detalle="Documentos terminados que Fierro todavía no tiene" />}
      </div>
    </>
  );
}
