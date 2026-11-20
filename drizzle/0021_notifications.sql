CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text NOT NULL,
	"key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "day_end_on" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "taken_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "muted_notifications" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_company_id_key_idx" ON "notifications" USING btree ("company_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_id_key_unread_idx" ON "notifications" USING btree ("user_id","key") WHERE "notifications"."read_at" is null;--> statement-breakpoint
-- Orders already being picked are watched from now on.
UPDATE "orders" SET "taken_at" = now() WHERE "status" = 'in_picking';
