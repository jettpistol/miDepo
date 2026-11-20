ALTER TABLE "companies" ADD COLUMN "control_min_units" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "same_person_checks" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "checked" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "controlled_by" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "packed_by" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_controlled_by_users_id_fk" FOREIGN KEY ("controlled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_packed_by_users_id_fk" FOREIGN KEY ("packed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;