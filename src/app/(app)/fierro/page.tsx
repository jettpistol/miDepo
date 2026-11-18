import Link from "next/link";
import { BotonAccion } from "@/components/Escaneo";
import { Icono } from "@/components/Icono";
import { Aviso, Encabezado, fechaCorta, Insignia, Vacio } from "@/components/ui";
import { conector } from "@/lib/fierro";
import { NOMBRE_ENVIO, pendientesDeEnvio } from "@/lib/flujos/envios";
import { requerir } from "@/lib/sesion";
import { enviar, simular, sincronizarAhora } from "./acciones";

export const metadata = { title: "Fierro" };

export default async function Fierro() {
  const { db, empresa } = await requerir("supervisor", "fierro");
  const pendientes = await pendientesDeEnvio(db, empresa.id);
  const simulado = conector(db, empresa).modo === "simulado";

  return (
    <>
      <Encabezado titulo="Fierro" bajada="Fierro manda en catálogo, clientes y pedidos. miDepo le devuelve lo que pasó en el depósito.">
        <Link href="/fierro/conciliacion" className="boton-suave">
          Conciliar stock
        </Link>
      </Encabezado>

      {simulado && (
        <div className="mb-5">
          <Aviso tono="alerta">
            <strong>Modo de prueba:</strong> este depósito está conectado a un Fierro simulado con datos inventados. Nada de lo que hagas acá llega a un Fierro real.
          </Aviso>
        </div>
      )}

      <section className="tarjeta mb-5 p-5">
        <h2 className="font-semibold">Traer novedades de Fierro</h2>
        <p className="mb-3 text-sm text-suave">Última sincronización: {empresa.ultimaSync ? fechaCorta(empresa.ultimaSync) : "nunca"}. Trae títulos nuevos, clientes, pedidos pendientes e ingresos avisados.</p>
        <div className="flex flex-wrap gap-2">
          <BotonAccion accion={sincronizarAhora}>
            <Icono nombre="fierro" /> Sincronizar ahora
          </BotonAccion>
          {simulado && (
            <>
              <BotonAccion accion={simular} ocultos={{ que: "pedidos", cuantos: 10 }} clase="boton-suave">
                Simular 10 pedidos nuevos
              </BotonAccion>
              <BotonAccion accion={simular} ocultos={{ que: "ingresos", cuantos: 1 }} clase="boton-suave">
                Simular un ingreso avisado
              </BotonAccion>
            </>
          )}
        </div>
      </section>

      <h2 className="mb-1 font-semibold">Para cargar en Fierro ({pendientes.length})</h2>
      <p className="mb-3 text-sm text-suave">Descargá el archivo, cargalo en Fierro y después marcalo como cargado. Un pedido sale del stock del depósito recién en ese momento.</p>
      {pendientes.length === 0 ? (
        <Vacio titulo="Fierro está al día">No hay documentos del depósito sin informar.</Vacio>
      ) : (
        <ul className="space-y-2">
          {pendientes.map((p) => (
            <li key={`${p.tipo}-${p.id}`} className="tarjeta flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
              <span className="min-w-0 flex-1 basis-56">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  <Insignia tono="acento">{NOMBRE_ENVIO[p.tipo]}</Insignia> {p.numero}
                </span>
                <span className="block truncate text-sm text-suave">{p.detalle}</span>
              </span>
              <a href={`/api/exportar/${p.tipo}/${p.id}`} className="boton-suave" download>
                <Icono nombre="descargar" /> CSV
              </a>
              <BotonAccion accion={enviar} ocultos={{ tipo: p.tipo, id: p.id }} confirmar={`¿Ya cargaste ${p.numero} en Fierro?`}>
                Marcar como cargado
              </BotonAccion>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
