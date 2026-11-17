import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { boxItems, boxes, customers, orderLines, orders, products } from "@/db/schema";

export async function orderWithBoxes(db: DB, companyId: number, id: number) {
  const [row] = await db.select({ p: orders, customer: customers }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(and(eq(orders.id, id), eq(orders.companyId, companyId)));
  if (!row) notFound();
  const list = await db.select().from(boxes).where(and(eq(boxes.orderId, id), eq(boxes.status, "closed"))).orderBy(asc(boxes.number));
  const items = list.length
    ? await db.select({ boxId: boxItems.boxId, quantity: boxItems.quantity, title: products.title, code: products.barcode }).from(boxItems).innerJoin(products, eq(products.id, boxItems.productId)).where(inArray(boxItems.boxId, list.map((k) => k.id))).orderBy(asc(products.title))
    : [];
  const lines = await db.select({ l: orderLines, title: products.title }).from(orderLines).innerJoin(products, eq(products.id, orderLines.productId)).where(eq(orderLines.orderId, id)).orderBy(asc(products.title));
  return { ...row, boxes: list, items, lines };
}

export const kilos = (g: number | null) => ((g ?? 0) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 });
