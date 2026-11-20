import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import sharp from "sharp";
import type { Executor } from "@/db";
import { products, productThumbs } from "@/db/schema";

/** Thumbnail size in pixels: twice the size it is shown at in lists (56 × 80), for sharp screens. */
export const THUMB = { width: 112, height: 160 } as const;

/** Reads the original cover: a path under /public, or a URL. null when it cannot be read. */
async function original(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("/")) return await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), "public", path.normalize(url)));
    if (!/^https?:\/\//.test(url)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Shrinks a cover to the list size, cropped to the book's proportion. */
export async function thumbnail(image: Buffer): Promise<Buffer> {
  return sharp(image).rotate().resize(THUMB.width, THUMB.height, { fit: "cover" }).webp({ quality: 72 }).toBuffer();
}

/**
 * Makes the thumbnails that are missing or out of date for a company, once, so lists never
 * resize anything while someone waits. Runs after every Fierro sync and on `db:setup`.
 * A cover that cannot be read leaves the product without thumbnail; the next run tries again.
 */
export async function makeThumbnails(db: Executor, companyId: number) {
  const pending = await db
    .select({ id: products.id, url: products.coverUrl, version: products.thumbVersion })
    .from(products)
    .leftJoin(productThumbs, eq(productThumbs.productId, products.id))
    .where(and(eq(products.companyId, companyId), isNotNull(products.coverUrl), or(isNull(productThumbs.source), ne(productThumbs.source, products.coverUrl))));
  let made = 0;
  let failed = 0;
  // A few at a time: covers may come from the network.
  for (let i = 0; i < pending.length; i += 8) {
    await Promise.all(
      pending.slice(i, i + 8).map(async (p) => {
        const image = await original(p.url!);
        const data = image && (await thumbnail(image).catch(() => null));
        if (!data) return void failed++;
        const row = { productId: p.id, source: p.url!, data: data.toString("base64") };
        await db.insert(productThumbs).values(row).onConflictDoUpdate({ target: productThumbs.productId, set: { source: row.source, data: row.data } });
        await db.update(products).set({ thumbVersion: (p.version ?? 0) + 1 }).where(eq(products.id, p.id));
        made++;
      }),
    );
  }
  // Fierro dropped the cover: so does the list.
  const gone = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.companyId, companyId), isNull(products.coverUrl), isNotNull(products.thumbVersion)));
  if (gone.length > 0) {
    await db.delete(productThumbs).where(sql`${productThumbs.productId} in (${sql.join(gone.map((g) => sql`${g.id}`), sql`, `)})`);
    await db.update(products).set({ thumbVersion: null }).where(sql`${products.id} in (${sql.join(gone.map((g) => sql`${g.id}`), sql`, `)})`);
  }
  return { made, failed };
}
