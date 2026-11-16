import { getDb } from "@/db";
import { ErrorUsuario } from "@/lib/errores";
import { archivoPara, type TipoEnvio } from "@/lib/flujos/envios";
import { puede, sesionActual } from "@/lib/sesion";

/** Descarga el CSV de un documento del depósito para cargarlo en Fierro. */
export async function GET(_: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const s = await sesionActual();
  if (!s || !puede(s.usuario.rol, "supervisor")) return new Response("No autorizado", { status: 401 });
  const { tipo, id } = await params;
  if (!["pedido", "recepcion", "devolucion", "conteo"].includes(tipo)) return new Response("No existe", { status: 404 });
  try {
    const archivo = await archivoPara(await getDb(), s.empresa.id, tipo as TipoEnvio, Number(id));
    return new Response(archivo.contenido, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${archivo.nombre}"` } });
  } catch (e) {
    if (e instanceof ErrorUsuario) return new Response(e.message, { status: 404 });
    throw e;
  }
}
