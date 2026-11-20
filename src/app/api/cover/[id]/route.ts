import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products, productThumbs } from "@/db/schema";
import { currentSession } from "@/lib/session";

/** List-size cover of a product in the same company, made beforehand by src/lib/covers.ts. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await currentSession();
  if (!s) return new Response(null, { status: 401 });
  const [thumb] = await (await getDb())
    .select({ data: productThumbs.data })
    .from(productThumbs)
    .innerJoin(products, eq(products.id, productThumbs.productId))
    .where(and(eq(productThumbs.productId, Number((await params).id)), eq(products.companyId, s.company.id)));
  if (!thumb) return new Response(null, { status: 404 });
  // The URL carries the version (?v=), so the browser can cache it without asking again.
  return new Response(Buffer.from(thumb.data, "base64"), { headers: { "content-type": "image/webp", "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
