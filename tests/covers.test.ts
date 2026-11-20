import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import sharp from "sharp";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb, runMigrations, type DB } from "@/db";
import { products, productThumbs } from "@/db/schema";
import { createCompany } from "@/db/seed";
import { makeThumbnails, THUMB, thumbnail } from "@/lib/covers";

const A = "/covers/ovnipress/a-business-proposal-vol-1.webp";
const B = "/covers/ovnipress/100-balas-vol-1-1c5ok.webp";

let db: DB;
let companyId: number;
let productId: number;
const thumb = async () => (await db.select().from(productThumbs).where(eq(productThumbs.productId, productId)))[0];
const version = async () => (await db.select({ v: products.thumbVersion }).from(products).where(eq(products.id, productId)))[0].v;

beforeAll(async () => {
  await runMigrations();
  db = await getDb();
  companyId = (await createCompany(db, { name: "Portadas", slug: "portadas" })).id;
  [{ id: productId }] = await db.insert(products).values({ companyId, fierroId: "P1", internalCode: "POR-1", barcode: "POR-1", title: "Con portada", coverUrl: A }).returning({ id: products.id });
});

describe("list covers", () => {
  it("shrinks a cover to the list size, as WebP and much lighter than the original", async () => {
    const original = await readFile(`public${A}`);
    const small = await thumbnail(original);
    const meta = await sharp(small).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", THUMB.width, THUMB.height]);
    expect(small.length).toBeLessThan(original.length / 4);
  });

  it("makes each thumbnail once, remakes it when the cover changes and drops it when the cover goes", async () => {
    expect(await makeThumbnails(db, companyId)).toEqual({ made: 1, failed: 0 });
    expect((await thumb()).source).toBe(A);
    expect(await version()).toBe(1);

    expect(await makeThumbnails(db, companyId)).toEqual({ made: 0, failed: 0 });

    await db.update(products).set({ coverUrl: B }).where(eq(products.id, productId));
    expect(await makeThumbnails(db, companyId)).toEqual({ made: 1, failed: 0 });
    expect((await thumb()).source).toBe(B);
    expect(await version()).toBe(2);

    await db.update(products).set({ coverUrl: null }).where(eq(products.id, productId));
    await makeThumbnails(db, companyId);
    expect(await thumb()).toBeUndefined();
    expect(await version()).toBeNull();
  });

  it("leaves a product without thumbnail when its cover cannot be read, and tries again next time", async () => {
    await db.update(products).set({ coverUrl: "/covers/no-existe.webp" }).where(eq(products.id, productId));
    expect(await makeThumbnails(db, companyId)).toEqual({ made: 0, failed: 1 });
    expect(await makeThumbnails(db, companyId)).toEqual({ made: 0, failed: 1 });
    expect(await thumb()).toBeUndefined();
  });
});
