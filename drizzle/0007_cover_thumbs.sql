CREATE TABLE "product_thumbs" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "thumb_version" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "list_view" text DEFAULT 'cards' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_thumbs" ADD CONSTRAINT "product_thumbs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;