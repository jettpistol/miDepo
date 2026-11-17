CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receivings" ADD COLUMN "supplier_id" integer;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_company_id_name_idx" ON "suppliers" USING btree ("company_id",lower("name"));--> statement-breakpoint
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Existing receivings: each distinct origin text becomes a supplier, and the receiving points at it.
INSERT INTO "suppliers" ("company_id", "name")
SELECT DISTINCT ON ("company_id", lower(trim("supplier"))) "company_id", trim("supplier") FROM "receivings" WHERE trim("supplier") <> ''
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "receivings" r SET "supplier_id" = s."id" FROM "suppliers" s
WHERE s."company_id" = r."company_id" AND lower(s."name") = lower(trim(r."supplier"));
