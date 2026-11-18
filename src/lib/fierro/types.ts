import type { ProductType } from "@/db/schema";

/** What miDepo reads from Fierro. Every `id` is Fierro's identifier, not ours. */
export type FierroBook = {
  id: string;
  internalCode: string;
  isbn: string | null;
  barcode: string;
  title: string;
  author: string;
  imprint: string;
  type: ProductType;
  price: number;
  weightGrams: number;
  coverUrl?: string | null;
};
export type FierroCustomer = { id: string; name: string; address: string; city: string; province: string };
export type FierroLine = { bookId: string; quantity: number };
export type FierroOrder = {
  id: string;
  number: string;
  customerId: string;
  saleMode: "firm" | "consignment";
  date: Date;
  lines: FierroLine[];
};
export type FierroReceipt = { id: string; number: string; supplier: string; date: Date; lines: FierroLine[] };

/** What miDepo gives back to Fierro: how much each title's stock changed and why. */
export type FierroDocument = {
  type: "shipment" | "receiving" | "return" | "count" | "adjustment";
  reference: string;
  lines: { productId: number; delta: number }[];
};

/**
 * The boundary with Fierro. Today the only implementation is the simulated one; the real connector
 * (B2B API, "data access" views or files) has to satisfy this same interface,
 * and the rest of miDepo does not notice the change.
 */
export interface FierroConnector {
  readonly mode: "simulated" | "real";
  books(): Promise<FierroBook[]>;
  customers(): Promise<FierroCustomer[]>;
  pendingOrders(): Promise<FierroOrder[]>;
  expectedReceipts(): Promise<FierroReceipt[]>;
  /** Total stock per title according to Fierro (key: Fierro's id). */
  stock(): Promise<Map<string, number>>;
  /** Reports to Fierro a document finished in the warehouse. */
  submit(doc: FierroDocument): Promise<void>;
}
