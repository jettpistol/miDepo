CREATE TABLE "box_items" (
	"box_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "box_items_box_id_product_id_pk" PRIMARY KEY("box_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "boxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"number" integer NOT NULL,
	"weight_grams" integer,
	"status" text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"location_scheme" jsonb,
	"sim_orders" integer DEFAULT 0 NOT NULL,
	"sim_receipts" integer DEFAULT 0 NOT NULL,
	"sim_seed" integer DEFAULT 1 NOT NULL,
	"sim_titles" integer DEFAULT 500 NOT NULL,
	"sim_customers" integer DEFAULT 60 NOT NULL,
	"last_sync" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "count_lines" (
	"count_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"counted_qty" integer DEFAULT 0 NOT NULL,
	"system" integer,
	CONSTRAINT "count_lines_count_id_location_id_product_id_pk" PRIMARY KEY("count_id","location_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "count_locations" (
	"count_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"counted_by" integer,
	CONSTRAINT "count_locations_count_id_location_id_pk" PRIMARY KEY("count_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "counts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_to_fierro" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"fierro_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"province" text
);
--> statement-breakpoint
CREATE TABLE "fierro_stock" (
	"company_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "fierro_stock_company_id_product_id_pk" PRIMARY KEY("company_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"code" text NOT NULL,
	"type" text DEFAULT 'shelf' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"from_id" integer,
	"to_id" integer,
	"quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"reference" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"picked" integer DEFAULT 0 NOT NULL,
	"packed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"fierro_id" text NOT NULL,
	"number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"sale_mode" text DEFAULT 'firm' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"taken_by" integer,
	"sent_to_fierro" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"public_key_data" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"carriers" text,
	"name" text DEFAULT 'Llave de acceso' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pick_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"line_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"location_id" integer,
	"quantity" integer NOT NULL,
	"picked" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"fierro_id" text NOT NULL,
	"internal_code" text NOT NULL,
	"isbn" text,
	"barcode" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"imprint" text,
	"type" text DEFAULT 'book' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"weight_grams" integer DEFAULT 300 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receiving_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"receiving_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"expected" integer DEFAULT 0 NOT NULL,
	"received" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"fierro_id" text,
	"number" text NOT NULL,
	"supplier" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_to_fierro" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "return_lines" (
	"return_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"book_condition" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "return_lines_return_id_product_id_book_condition_pk" PRIMARY KEY("return_id","product_id","book_condition")
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_to_fierro" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"company_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stock_product_id_location_id_pk" PRIMARY KEY("product_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "user_photos" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"pin_hmac" text,
	"role" text DEFAULT 'operator' NOT NULL,
	"accent" text DEFAULT '#002FA7' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"photo_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "box_items" ADD CONSTRAINT "box_items_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "box_items" ADD CONSTRAINT "box_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boxes" ADD CONSTRAINT "boxes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boxes" ADD CONSTRAINT "boxes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "count_lines" ADD CONSTRAINT "count_lines_count_id_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "public"."counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "count_lines" ADD CONSTRAINT "count_lines_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "count_lines" ADD CONSTRAINT "count_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "count_locations" ADD CONSTRAINT "count_locations_count_id_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "public"."counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "count_locations" ADD CONSTRAINT "count_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "count_locations" ADD CONSTRAINT "count_locations_counted_by_users_id_fk" FOREIGN KEY ("counted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counts" ADD CONSTRAINT "counts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fierro_stock" ADD CONSTRAINT "fierro_stock_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fierro_stock" ADD CONSTRAINT "fierro_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_from_id_locations_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_to_id_locations_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_taken_by_users_id_fk" FOREIGN KEY ("taken_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_line_id_order_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiving_lines" ADD CONSTRAINT "receiving_lines_receiving_id_receivings_id_fk" FOREIGN KEY ("receiving_id") REFERENCES "public"."receivings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiving_lines" ADD CONSTRAINT "receiving_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boxes_order_id_idx" ON "boxes" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_company_id_fierro_id_idx" ON "customers" USING btree ("company_id","fierro_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_company_id_code_idx" ON "locations" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "movements_product_id_created_at_idx" ON "movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "order_lines_order_id_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_company_id_fierro_id_idx" ON "orders" USING btree ("company_id","fierro_id");--> statement-breakpoint
CREATE INDEX "orders_company_id_status_idx" ON "orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "pick_tasks_order_id_idx" ON "pick_tasks" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_id_fierro_id_idx" ON "products" USING btree ("company_id","fierro_id");--> statement-breakpoint
CREATE INDEX "products_company_id_barcode_idx" ON "products" USING btree ("company_id","barcode");--> statement-breakpoint
CREATE INDEX "products_company_id_isbn_idx" ON "products" USING btree ("company_id","isbn");--> statement-breakpoint
CREATE INDEX "products_company_id_internal_code_idx" ON "products" USING btree ("company_id","internal_code");--> statement-breakpoint
CREATE UNIQUE INDEX "receiving_lines_receiving_id_product_id_idx" ON "receiving_lines" USING btree ("receiving_id","product_id");--> statement-breakpoint
CREATE INDEX "receivings_company_id_status_idx" ON "receivings" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "stock_location_id_idx" ON "stock" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_company_id_pin_hmac_idx" ON "users" USING btree ("company_id","pin_hmac");