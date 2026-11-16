import { Encabezado, Vacio } from "@/components/ui";
import { requerir } from "@/lib/sesion";
import { EnPreparacion, pedidosAbiertos, Pendientes } from "./Tablas";

export const metadata = { title: "Picking" };

export default async function Picking() {
  const { db, empresa, usuario } = await requerir();
  const { enCurso, pendientes } = await pedidosAbiertos(db, empresa.id);

  return (
    <>
      <Encabezado titulo="Picking" />

      {enCurso.length > 0 && (
        <section className="mb-9">
          <h2 className="titulo-seccion">
            En preparación <small>{enCurso.length}</small>
          </h2>
          <EnPreparacion filas={enCurso} usuarioId={usuario.id} />
        </section>
      )}

      <section>
        <h2 className="titulo-seccion">
          Pendientes <small>{pendientes.length}</small>
        </h2>
        {pendientes.length === 0 ? <Vacio titulo="No hay pedidos pendientes">Los pedidos nuevos aparecen cuando se sincroniza con Fierro.</Vacio> : <Pendientes filas={pendientes} />}
      </section>
    </>
  );
}
