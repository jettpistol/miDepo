CREATE TABLE "adjustment_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"adjustment_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"cause" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"number" text NOT NULL,
	"count_id" integer,
	"approved_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_to_fierro" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "count_locations" ADD COLUMN "first_counted_by" integer;--> statement-breakpoint
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_adjustment_id_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."adjustments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_lines" ADD CONSTRAINT "adjustment_lines_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_count_id_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "public"."counts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adjustment_lines_adjustment_id_idx" ON "adjustment_lines" USING btree ("adjustment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "adjustments_company_id_number_idx" ON "adjustments" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "adjustments_company_id_created_at_idx" ON "adjustments" USING btree ("company_id","created_at");--> statement-breakpoint
ALTER TABLE "count_locations" ADD CONSTRAINT "count_locations_first_counted_by_users_id_fk" FOREIGN KEY ("first_counted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Existing companies get the FALTANTES zone (new companies get it from ZONES in createCompany).
INSERT INTO "locations" ("company_id", "code", "type") SELECT "id", 'FALTANTES', 'missing' FROM "companies" ON CONFLICT DO NOTHING;
