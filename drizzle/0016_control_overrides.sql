ALTER TABLE "customers" ADD COLUMN "always_control" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "same_check_allowed_by" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_same_check_allowed_by_users_id_fk" FOREIGN KEY ("same_check_allowed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;