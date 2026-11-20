import type { orders } from "@/db/schema";

type Order = Pick<typeof orders.$inferSelect, "status" | "fierroChange" | "unknownLines">;

/**
 * What Fierro says about an order that the floor must know before working on it, or null.
 * The same text is the reason "Preparar" is disabled, so the screen and takeOrder agree.
 */
export function fierroWarning(o: Order): string | null {
  if (o.status === "cancelled") return "Ya no figura como pendiente en Fierro.";
  if (o.unknownLines > 0) return `${o.unknownLines === 1 ? "Un artículo no está" : `${o.unknownLines} artículos no están`} en el catálogo. Sincroniza con Fierro cuando estén cargados.`;
  if (o.fierroChange === "changed") return o.status === "pending" ? "Fierro cambió este pedido. Sincroniza antes de prepararlo." : "Fierro cambió este pedido después de empezado. Suéltalo para aplicar el cambio.";
  if (o.fierroChange === "gone") return "Ya no figura como pendiente en Fierro.";
  return null;
}

/** Fierro's "condición de venta" of an order, as Fierro writes it. */
export const SALE_MODE = { firm: "Firme", consignment: "Consignación" } as const;
