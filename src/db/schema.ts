import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ───────────── Companies and users ─────────────

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** Short code operators type once on the phone to log in with a PIN. */
  slug: text("slug").notNull().unique(),
  /** The chosen location naming scheme (see src/lib/locations.ts). */
  locationScheme: jsonb("location_scheme"),
  /** State of the simulated Fierro: how many orders and receipts "exist" on the other side. */
  simOrders: integer("sim_orders").notNull().default(0),
  simReceipts: integer("sim_receipts").notNull().default(0),
  simSeed: integer("sim_seed").notNull().default(1),
  simTitles: integer("sim_titles").notNull().default(500),
  simCustomers: integer("sim_customers").notNull().default(60),
  lastSync: timestamp("last_sync", { withTimezone: true }),
  createdAt: createdAt(),
});

export type Role = "operator" | "supervisor" | "admin";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    /** HMAC of the PIN: lets an operator be identified by PIN alone within their company. */
    pinHmac: text("pin_hmac"),
    role: text("role").$type<Role>().notNull().default("operator"),
    accent: text("accent").notNull().default("#002FA7"),
    theme: text("theme").$type<"light" | "dark" | "system">().notNull().default("system"),
    /** Interface font, one of the ids in src/lib/fonts.ts. */
    font: text("font").notNull().default("libre-franklin"),
    active: boolean("active").notNull().default(true),
    /** null = no photo. Changes with every new photo, so the browser does not show the old one. */
    photoVersion: integer("photo_version"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_company_id_pin_hmac_idx").on(t.companyId, t.pinHmac)],
);

/** The photo sits in its own table so it is not loaded on every user query. */
export const userPhotos = pgTable("user_photos", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  /** Square 256 px JPEG, base64. */
  data: text("data").notNull(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(), // credential ID (base64url)
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  publicKeyData: text("public_key_data").notNull(), // base64url
  sequence: integer("sequence").notNull().default(0),
  carriers: text("carriers"),
  name: text("name").notNull().default("Llave de acceso"),
  createdAt: createdAt(),
});

export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

// ───────────── Mirror of Fierro (read-only for miDepo) ─────────────

export type ProductType = "book" | "floppy" | "variant" | "pack";

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    fierroId: text("fierro_id").notNull(),
    internalCode: text("internal_code").notNull(),
    isbn: text("isbn"),
    /** What the scanner reads: the printed EAN/ISBN, or the internal code if the item has no ISBN. */
    barcode: text("barcode").notNull(),
    title: text("title").notNull(),
    author: text("author"),
    imprint: text("imprint"),
    type: text("type").$type<ProductType>().notNull().default("book"),
    price: integer("price").notNull().default(0),
    weightGrams: integer("weight_grams").notNull().default(300),
    /** Cover picture (a path under /public or a URL); null when Fierro has none. */
    coverUrl: text("cover_url"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("products_company_id_fierro_id_idx").on(t.companyId, t.fierroId),
    index("products_company_id_barcode_idx").on(t.companyId, t.barcode),
    index("products_company_id_isbn_idx").on(t.companyId, t.isbn),
    index("products_company_id_internal_code_idx").on(t.companyId, t.internalCode),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    fierroId: text("fierro_id").notNull(),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    province: text("province"),
  },
  (t) => [uniqueIndex("customers_company_id_fierro_id_idx").on(t.companyId, t.fierroId)],
);

/** The stock Fierro believes it has, per product. Compared against miDepo in the reconciliation. */
export const fierroStock = pgTable(
  "fierro_stock",
  {
    companyId: integer("company_id").notNull().references(() => companies.id),
    productId: integer("product_id").notNull().references(() => products.id),
    quantity: integer("quantity").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.productId] })],
);

// ───────────── What miDepo owns: locations and physical stock ─────────────

export type LocationType = "shelf" | "receiving" | "returns" | "damaged" | "clearance" | "staging";

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    code: text("code").notNull(),
    type: text("type").$type<LocationType>().notNull().default("shelf"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("locations_company_id_code_idx").on(t.companyId, t.code)],
);

export const stock = pgTable(
  "stock",
  {
    companyId: integer("company_id").notNull().references(() => companies.id),
    productId: integer("product_id").notNull().references(() => products.id),
    locationId: integer("location_id").notNull().references(() => locations.id),
    quantity: integer("quantity").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.locationId] }), index("stock_location_id_idx").on(t.locationId)],
);

export type MovementReason =
  | "initial"
  | "receiving"
  | "putaway"
  | "movement"
  | "picking"
  | "shipment"
  | "return"
  | "count_adjustment";

export const movements = pgTable(
  "movements",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    productId: integer("product_id").notNull().references(() => products.id),
    fromId: integer("from_id").references(() => locations.id),
    toId: integer("to_id").references(() => locations.id),
    quantity: integer("quantity").notNull(),
    reason: text("reason").$type<MovementReason>().notNull(),
    reference: text("reference"),
    userId: integer("user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("movements_product_id_created_at_idx").on(t.productId, t.createdAt)],
);

// ───────────── Outbound: orders, picking and boxes ─────────────

export type OrderStatus = "pending" | "in_picking" | "picked" | "packed" | "shipped";

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    fierroId: text("fierro_id").notNull(),
    number: text("number").notNull(),
    customerId: integer("customer_id").notNull().references(() => customers.id),
    saleMode: text("sale_mode").$type<"firm" | "consignment">().notNull().default("firm"),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    takenBy: integer("taken_by").references(() => users.id),
    sentToFierro: timestamp("sent_to_fierro", { withTimezone: true }),
  },
  (t) => [uniqueIndex("orders_company_id_fierro_id_idx").on(t.companyId, t.fierroId), index("orders_company_id_status_idx").on(t.companyId, t.status)],
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    quantity: integer("quantity").notNull(),
    picked: integer("picked").notNull().default(0),
    packed: integer("packed").notNull().default(0),
  },
  (t) => [index("order_lines_order_id_idx").on(t.orderId)],
);

/** One stop on the route: "go to this location and take N of this title". */
export const pickTasks = pgTable(
  "pick_tasks",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    lineId: integer("line_id").notNull().references(() => orderLines.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    /** null = no shelf had stock when the route was built. */
    locationId: integer("location_id").references(() => locations.id),
    quantity: integer("quantity").notNull(),
    picked: integer("picked").notNull().default(0),
    status: text("status").$type<"pending" | "done" | "short">().notNull().default("pending"),
  },
  (t) => [index("pick_tasks_order_id_idx").on(t.orderId)],
);

export const boxes = pgTable(
  "boxes",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    weightGrams: integer("weight_grams"),
    status: text("status").$type<"open" | "closed">().notNull().default("open"),
  },
  (t) => [index("boxes_order_id_idx").on(t.orderId)],
);

export const boxItems = pgTable(
  "box_items",
  {
    boxId: integer("box_id").notNull().references(() => boxes.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.boxId, t.productId] })],
);

// ───────────── Inbound: receivings and returns ─────────────

/** Who sends stock in. Filled from Fierro on sync; a receiving can only name one of these. */
export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    /** null = came from Fierro; otherwise the person who created it in miDepo. */
    createdBy: integer("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("suppliers_company_id_name_idx").on(t.companyId, sql`lower(${t.name})`)],
);

export const receivings = pgTable(
  "receivings",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    /** null = unannounced receiving, created in the warehouse. */
    fierroId: text("fierro_id"),
    number: text("number").notNull(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    status: text("status").$type<"pending" | "in_progress" | "closed">().notNull().default("pending"),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    sentToFierro: timestamp("sent_to_fierro", { withTimezone: true }),
  },
  (t) => [index("receivings_company_id_status_idx").on(t.companyId, t.status)],
);

export const receivingLines = pgTable(
  "receiving_lines",
  {
    id: serial("id").primaryKey(),
    receivingId: integer("receiving_id").notNull().references(() => receivings.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    expected: integer("expected").notNull().default(0),
    received: integer("received").notNull().default(0),
  },
  (t) => [uniqueIndex("receiving_lines_receiving_id_product_id_idx").on(t.receivingId, t.productId)],
);

export type BookCondition = "sellable" | "damaged" | "clearance";

export const returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  number: text("number").notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  status: text("status").$type<"in_progress" | "closed">().notNull().default("in_progress"),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  sentToFierro: timestamp("sent_to_fierro", { withTimezone: true }),
});

export const returnLines = pgTable(
  "return_lines",
  {
    returnId: integer("return_id").notNull().references(() => returns.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    bookCondition: text("book_condition").$type<BookCondition>().notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.returnId, t.productId, t.bookCondition] })],
);

// ───────────── Cycle counts ─────────────

export const counts = pgTable("counts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  status: text("status").$type<"open" | "closed">().notNull().default("open"),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  sentToFierro: timestamp("sent_to_fierro", { withTimezone: true }),
});

export const countLocations = pgTable(
  "count_locations",
  {
    countId: integer("count_id").notNull().references(() => counts.id, { onDelete: "cascade" }),
    locationId: integer("location_id").notNull().references(() => locations.id),
    status: text("status").$type<"pending" | "counted">().notNull().default("pending"),
    countedBy: integer("counted_by").references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.countId, t.locationId] })],
);

export const countLines = pgTable(
  "count_lines",
  {
    countId: integer("count_id").notNull().references(() => counts.id, { onDelete: "cascade" }),
    locationId: integer("location_id").notNull().references(() => locations.id),
    productId: integer("product_id").notNull().references(() => products.id),
    countedQty: integer("counted_qty").notNull().default(0),
    /** What the system said when the count was closed (kept as a record). */
    system: integer("system"),
  },
  (t) => [primaryKey({ columns: [t.countId, t.locationId, t.productId] })],
);

export const now = sql`now()`;
