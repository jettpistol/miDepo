import { getDb } from "@/db";
import { consultar } from "@/lib/consulta";
import { sesionActual } from "@/lib/sesion";

/** Ensayo de un formulario de escaneo: qué está bien, qué no y qué sugerir. No cambia nada. */
export async function GET(pedido: Request) {
  const s = await sesionActual();
  if (!s) return new Response(null, { status: 401 });
  const resultado = await consultar(await getDb(), s.empresa.id, new URL(pedido.url).searchParams);
  return Response.json(resultado, { headers: { "cache-control": "no-store" } });
}
