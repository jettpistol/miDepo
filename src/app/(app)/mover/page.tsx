import { Escaneo } from "@/components/Escaneo";
import { Encabezado } from "@/components/ui";
import { requerir } from "@/lib/sesion";
import { moverAccion } from "./acciones";

export const metadata = { title: "Mover" };

export default async function Mover() {
  await requerir();
  return (
    <>
      <Encabezado titulo="Mover" />
      <div className="max-w-md">
        <Escaneo
          accion={moverAccion}
          contexto="mover"
          campos={[
            { nombre: "origen", etiqueta: "Desde", ayuda: "Estante o zona" },
            { nombre: "producto", etiqueta: "Libro", ayuda: "Código, título o autor" },
            { nombre: "destino", etiqueta: "Hacia", ayuda: "Estante o zona" },
          ]}
          cantidad={1}
          boton="Mover"
        />
      </div>
    </>
  );
}
