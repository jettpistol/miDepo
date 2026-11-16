import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { usuarioFotos, usuarios } from "@/db/schema";
import { sesionActual } from "@/lib/sesion";

/** Foto de perfil de una persona de la misma empresa. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await sesionActual();
  if (!s) return new Response(null, { status: 401 });
  const [foto] = await (await getDb())
    .select({ datos: usuarioFotos.datos })
    .from(usuarioFotos)
    .innerJoin(usuarios, eq(usuarios.id, usuarioFotos.usuarioId))
    .where(and(eq(usuarioFotos.usuarioId, Number((await params).id)), eq(usuarios.empresaId, s.empresa.id)));
  if (!foto) return new Response(null, { status: 404 });
  // La dirección lleva la versión (?v=), así que el navegador puede guardarla sin volver a pedirla.
  return new Response(Buffer.from(foto.datos, "base64"), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
