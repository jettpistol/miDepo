import { Escaneo } from "@/components/Escaneo";
import { Encabezado } from "@/components/ui";
import { requerir } from "@/lib/sesion";
import { moverAccion } from "./acciones";

export const metadata = { title: "Mover" };

export default async function Mover() {
  await requerir("operario", "mover");
  return (
    <>
      <Encabezado titulo="Mover" bajada="Para cambiar libros de un estante a otro: reordenar, juntar un título o liberar un lugar." />
      <div className="max-w-md">
        <Escaneo
          accion={moverAccion}
          campos={[
            { nombre: "origen", etiqueta: "Desde", ayuda: "Ubicación de donde sacás" },
            { nombre: "producto", etiqueta: "Libro" },
            { nombre: "destino", etiqueta: "Hacia", ayuda: "Ubicación donde lo dejás" },
          ]}
          cantidad={1}
          boton="Mover"
        />
      </div>
    </>
  );
}
