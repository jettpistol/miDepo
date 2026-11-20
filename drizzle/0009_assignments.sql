ALTER TABLE "counts" ADD COLUMN "assigned_to" integer;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "assigned_to" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "assigned_to" integer;--> statement-breakpoint
ALTER TABLE "receivings" ADD COLUMN "assigned_to" integer;--> statement-breakpoint
ALTER TABLE "returns" ADD COLUMN "assigned_to" integer;--> statement-breakpoint
ALTER TABLE "counts" ADD CONSTRAINT "counts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movements_company_id_created_at_idx" ON "movements" USING btree ("company_id","created_at");