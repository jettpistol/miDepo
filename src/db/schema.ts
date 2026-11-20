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
  /** How a picking batch is split into orders: at packing, or into one tray per order while picking. */
  batchSorting: text("batch_sorting").$type<BatchSorting>().notNull().default("packing"),
  /**
   * Control step between picking and packing (Ajustes). null = no separate step: packing is the
   * control, since it scans every unit again. N = orders with at least N picked units go to Control.
   */
  controlMinUnits: integer("control_min_units"),
  /** Whether whoever picked an order may also control it (or pack it, when packing is the control). */
  samePersonChecks: boolean("same_person_checks").notNull().default(true),
  createdAt: createdAt(),
});

export type BatchSorting = "packing" | "trays";

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
    /** How product lists are shown: the table (default) or cards. Saved when the person switches. */
    listView: text("list_view").$type<"cards" | "table">().notNull().default("table"),
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
    /** null = no thumbnail yet. Changes with every new thumbnail, so the browser does not show the old one. */
    thumbVersion: integer("thumb_version"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("products_company_id_fierro_id_idx").on(t.companyId, t.fierroId),
    index("products_company_id_barcode_idx").on(t.companyId, t.barcode),
    index("products_company_id_isbn_idx").on(t.companyId, t.isbn),
    index("products_company_id_internal_code_idx").on(t.companyId, t.internalCode),
  ],
);

/**
 * Small copy of each cover for lists, made once from `products.cover_url` (src/lib/covers.ts),
 * so lists never load or resize the original. In its own table so product queries stay light.
 */
export const productThumbs = pgTable("product_thumbs", {
  productId: integer("product_id").primaryKey().references(() => products.id, { onDelete: "cascade" }),
  /** The cover_url it was made from: a different one means it must be made again. */
  source: text("source").notNull(),
  /** WebP, base64. */
  data: text("data").notNull(),
});

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

/** "missing" (FALTANTES) holds units a picker could not find: still owned, not yet written off. */
export type LocationType = "shelf" | "receiving" | "returns" | "damaged" | "clearance" | "staging" | "missing";

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    code: text("code").notNull(),
    type: text("type").$type<LocationType>().notNull().default("shelf"),
    active: boolean("active").notNull().default(true),
    /** RECEPCION and DEVOLUCIONES only: who a supervisor gave the put-away from this zone to (null = anyone). */
    assignedTo: integer("assigned_to").references(() => users.id),
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
  /** Before adjustment documents existed, a count changed stock with this reason. */
  | "count_adjustment"
  /** A count found a title short on one shelf and over on another: moved, not lost. */
  | "count_relocation"
  /** A picker could not find units: shelf → FALTANTES. */
  | "missing"
  /** Units turned up: FALTANTES → shelf, or enter from outside when a count finds more. */
  | "found"
  /** Units leave the warehouse with no customer: damaged, lost, stolen… Always has an adjustment. */
  | "write_off"
  /** Puts back an earlier movement: an undone pick, move, write-off, or a reopened receiving or return. */
  | "undo";

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
  (t) => [index("movements_product_id_created_at_idx").on(t.productId, t.createdAt), index("movements_company_id_created_at_idx").on(t.companyId, t.createdAt)],
);

// ───────────── Outbound: orders, picking and boxes ─────────────

/**
 * A picking batch (lote): several orders picked in one walk. The route asks for the total of each
 * title per shelf; the units are split into orders at packing or, with trays, while picking.
 */
export const pickBatches = pgTable(
  "pick_batches",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    /** Shown as LOTE-0001, counted per company. */
    number: integer("number").notNull(),
    takenBy: integer("taken_by").notNull().references(() => users.id),
    /** The company's setting when the batch was made; changing the setting does not change open batches. */
    sorting: text("sorting").$type<BatchSorting>().notNull(),
    status: text("status").$type<"open" | "done">().notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("pick_batches_company_id_number_idx").on(t.companyId, t.number)],
);

/** to_control: picked, waiting for the Control step (only when the company has it on). picked: ready to pack.
 * "cancelled": no longer pending in Fierro before anyone started it. It comes back if Fierro lists it again. */
export type OrderStatus = "pending" | "in_picking" | "to_control" | "picked" | "packed" | "shipped" | "cancelled";

/** What Fierro changed in an order that was already started; applied once the order is released. */
export type FierroChange = "changed" | "gone";

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
    /** The picking batch it was taken in, if any. */
    batchId: integer("batch_id").references(() => pickBatches.id),
    /** In a batch sorted into trays: the tray number for this order (1, 2, 3…). */
    tray: integer("tray"),
    /** Who a supervisor gave this to (null = anyone). It points, it does not lock: others can still work on it. */
    assignedTo: integer("assigned_to").references(() => users.id),
    /** Who finished the Control step (null if the order did not go through it). */
    controlledBy: integer("controlled_by").references(() => users.id),
    /** Who finished packing. */
    packedBy: integer("packed_by").references(() => users.id),
    sentToFierro: timestamp("sent_to_fierro", { withTimezone: true }),
    /** Set by sync when Fierro edited the order, or stopped listing it, after picking started. */
    fierroChange: text("fierro_change").$type<FierroChange>(),
    /** A supervisor marked it to go first (same-day delivery, a cutoff). Queues sort urgent first, then oldest. */
    urgent: boolean("urgent").notNull().default(false),
    /** Lines Fierro sent for articles not in the catalogue. Such an order cannot be taken until they are known. */
    unknownLines: integer("unknown_lines").notNull().default(0),
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
    /** Units counted again in the Control step. */
    checked: integer("checked").notNull().default(0),
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
    /** Units this stop sent to FALTANTES when the picker reported them missing; put back if that report is undone. */
    sentToMissing: integer("sent_to_missing").notNull().default(0),
    /** The stop whose shortage report created this one (miDepo found the title elsewhere). */
    replacesTaskId: integer("replaces_task_id"),
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
    /** Who a supervisor gave this to (null = anyone). It points, it does not lock: others can still work on it. */
    assignedTo: integer("assigned_to").references(() => users.id),
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
  /** Who a supervisor gave this to (null = anyone). It points, it does not lock: others can still work on it. */
  assignedTo: integer("assigned_to").references(() => users.id),
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
  /** Who a supervisor gave this to (null = anyone). It points, it does not lock: others can still work on it. */
  assignedTo: integer("assigned_to").references(() => users.id),
  sentToFierro: timestamp("sent_to_fierro", { withTimezone: true }),
});

export const countLocations = pgTable(
  "count_locations",
  {
    countId: integer("count_id").notNull().references(() => counts.id, { onDelete: "cascade" }),
    locationId: integer("location_id").notNull().references(() => locations.id),
    status: text("status").$type<"pending" | "counted">().notNull().default("pending"),
    countedBy: integer("counted_by").references(() => users.id),
    /** Set when a recount was asked for: who counted first. Someone else has to recount. */
    firstCountedBy: integer("first_counted_by").references(() => users.id),
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

// ───────────── Stock adjustments (write-offs and found stock) ─────────────

/** Why stock changed with no customer or supplier on the other side. */
export type AdjustmentCause = "count_difference" | "damage" | "theft_or_loss" | "entry_error" | "internal_use" | "found";

/**
 * A stock change with nobody on the other side, approved by a supervisor: a count's losses and
 * finds, or a write-off from FALTANTES or DANADOS. It is what Fierro is told, never a fake order.
 */
export const adjustments = pgTable(
  "adjustments",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companies.id),
    number: text("number").notNull(),
    /** Set when the adjustment comes from closing a count; it then reaches Fierro with the count. */
    countId: integer("count_id").references(() => counts.id),
    approvedBy: integer("approved_by").notNull().references(() => users.id),
    createdAt: createdAt(),
    sentToFierro: timestamp("sent_to_fierro", { withTimezone: true }),
  },
  (t) => [uniqueIndex("adjustments_company_id_number_idx").on(t.companyId, t.number), index("adjustments_company_id_created_at_idx").on(t.companyId, t.createdAt)],
);

export const adjustmentLines = pgTable(
  "adjustment_lines",
  {
    id: serial("id").primaryKey(),
    adjustmentId: integer("adjustment_id").notNull().references(() => adjustments.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    /** Where the units left from or arrived at. */
    locationId: integer("location_id").notNull().references(() => locations.id),
    /** Change in the warehouse's total stock: negative = written off, positive = found. */
    quantity: integer("quantity").notNull(),
    cause: text("cause").$type<AdjustmentCause>().notNull(),
  },
  (t) => [index("adjustment_lines_adjustment_id_idx").on(t.adjustmentId)],
);

export const now = sql`now()`;

// ───────────── Manual ─────────────

/**
 * A company's own version of a manual page (wiki/<page>.md), written by an administrator in
 * /ayuda/editar. That company's users read this instead of the file; everyone else, and anyone
 * not logged in, reads the file. Deleting the row puts the original back.
 */
export const wikiEdits = pgTable(
  "wiki_edits",
  {
    companyId: integer("company_id").notNull().references(() => companies.id),
    /** File name without .md, e.g. "Picking". */
    page: text("page").notNull(),
    markdown: text("markdown").notNull(),
    /** Hash of the file this edit started from: when the file changes later, the editor says so. */
    baseHash: text("base_hash").notNull(),
    updatedBy: integer("updated_by").notNull().references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.page] })],
);
