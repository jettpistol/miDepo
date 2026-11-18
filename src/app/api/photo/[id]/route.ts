import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userPhotos, users } from "@/db/schema";
import { currentSession } from "@/lib/session";

/** Profile photo of a person in the same company. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await currentSession();
  if (!s) return new Response(null, { status: 401 });
  const [photo] = await (await getDb())
    .select({ data: userPhotos.data })
    .from(userPhotos)
    .innerJoin(users, eq(users.id, userPhotos.userId))
    .where(and(eq(userPhotos.userId, Number((await params).id)), eq(users.companyId, s.company.id)));
  if (!photo) return new Response(null, { status: 404 });
  // The URL carries the version (?v=), so the browser can cache it without asking again.
  return new Response(Buffer.from(photo.data, "base64"), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
