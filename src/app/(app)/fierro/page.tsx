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
  const { db, empresa } = await requerir("supervisor");
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
        <div className="mb-6">
          <Aviso tono="alerta">
            <strong>Modo de prueba:</strong> este depósito está conectado a un Fierro simulado con datos inventados. Nada de lo que hagas acá llega a un Fierro real.
          </Aviso>
        </div>
      )}

      <section className="mb-9">
        <h2 className="titulo-seccion">Traer novedades de Fierro</h2>
        <p className="mb-3 max-w-[70ch] text-sm text-suave">Última sincronización: {empresa.ultimaSync ? fechaCorta(empresa.ultimaSync) : "nunca"}. Trae títulos nuevos, clientes, pedidos pendientes e ingresos avisados.</p>
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

      <section>
        <h2 className="titulo-seccion">
          Para cargar en Fierro <small>{pendientes.length}</small>
        </h2>
        <p className="mb-3 max-w-[70ch] text-sm text-suave">Descargá el archivo, cargalo en Fierro y después marcalo como cargado. Un pedido sale del stock del depósito recién en ese momento.</p>
        {pendientes.length === 0 ? (
          <Vacio titulo="Fierro está al día">No hay documentos del depósito sin informar.</Vacio>
        ) : (
          <div className="overflow-x-auto border-y border-borde">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th className="hidden sm:table-cell">Tipo</th>
                  <th className="hidden md:table-cell">Detalle</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendientes.map((p) => (
                  <tr key={`${p.tipo}-${p.id}`}>
                    <td>
                      <span className="numero">{p.numero}</span>
                      <span className="mt-1 block sm:hidden">
                        <Insignia tono="acento">{NOMBRE_ENVIO[p.tipo]}</Insignia>
                      </span>
                      <span className="block max-w-44 truncate text-suave sm:max-w-64 md:hidden">{p.detalle}</span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <Insignia tono="acento">{NOMBRE_ENVIO[p.tipo]}</Insignia>
                    </td>
                    <td className="hidden text-suave md:table-cell">{p.detalle}</td>
                    <td className="w-px">
                      <span className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                        <a href={`/api/exportar/${p.tipo}/${p.id}`} className="boton-chico" download>
                          <Icono nombre="descargar" className="size-4" /> CSV
                        </a>
                        <BotonAccion accion={enviar} ocultos={{ tipo: p.tipo, id: p.id }} clase="boton-chico" confirmar={`¿Ya cargaste ${p.numero} en Fierro?`}>
                          Marcar como cargado
                        </BotonAccion>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
