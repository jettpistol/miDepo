CREATE TABLE "pick_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"number" integer NOT NULL,
	"taken_by" integer NOT NULL,
	"sorting" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "batch_sorting" text DEFAULT 'packing' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "batch_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tray" integer;--> statement-breakpoint
ALTER TABLE "pick_batches" ADD CONSTRAINT "pick_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_batches" ADD CONSTRAINT "pick_batches_taken_by_users_id_fk" FOREIGN KEY ("taken_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pick_batches_company_id_number_idx" ON "pick_batches" USING btree ("company_id","number");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_batch_id_pick_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."pick_batches"("id") ON DELETE no action ON UPDATE no action;