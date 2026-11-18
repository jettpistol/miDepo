import { Formulario } from "@/components/Escaneo";
import { Aviso, Encabezado } from "@/components/ui";
import { MODULOS, moduloActivo } from "@/lib/modulos";
import { requerir } from "@/lib/sesion";
import { guardarAjustes } from "./acciones";

export const metadata = { title: "Ajustes" };

export default async function Ajustes() {
  const { empresa } = await requerir("admin");
  return (
    <>
      <Encabezado titulo="Ajustes" bajada={`Cómo trabaja ${empresa.nombre} con miDepo.`} />
      <div className="mb-5">
        <Aviso>En los dos modos el stock físico es de miDepo: cuántos libros hay y en qué estante.</Aviso>
      </div>
      <Formulario accion={guardarAjustes} boton="Guardar ajustes" reiniciar={false} clase="space-y-6">
        <fieldset className="space-y-2">
          <legend className="etiqueta">Modo de trabajo</legend>
          {[
            { id: "fierro", nombre: "Con Fierro", ayuda: "Fierro lleva catálogo, pedidos, remitos y facturas. miDepo lleva el depósito." },
            { id: "independiente", nombre: "Independiente", ayuda: "miDepo es todo el sistema de depósito. Catálogo, clientes y pedidos se cargan en miDepo." },
          ].map((m) => (
            <label key={m.id} className="tarjeta flex cursor-pointer items-start gap-3 p-4">
              <input type="radio" name="modo" value={m.id} defaultChecked={empresa.modo === m.id} className="mt-1" />
              <span>
                <span className="block font-semibold">{m.nombre}</span>
                <span className="block text-sm text-suave">{m.ayuda}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="etiqueta">Módulos activos</legend>
          <p className="text-sm text-suave">Para empezar de a poco, encendé solo lo que el equipo ya sabe usar. Lo apagado desaparece del menú y no se puede usar.</p>
          {MODULOS.map((m) => (
            <label key={m.id} className="tarjeta flex cursor-pointer items-start gap-3 p-4">
              <input type="checkbox" name={`m_${m.id}`} defaultChecked={moduloActivo(empresa, m.id)} className="mt-1" />
              <span>
                <span className="block font-semibold">{m.nombre}</span>
                <span className="block text-sm text-suave">{m.ayuda}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </Formulario>
    </>
  );
}
