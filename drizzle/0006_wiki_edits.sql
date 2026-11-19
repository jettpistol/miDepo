CREATE TABLE "wiki_edits" (
	"company_id" integer NOT NULL,
	"page" text NOT NULL,
	"markdown" text NOT NULL,
	"base_hash" text NOT NULL,
	"updated_by" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_edits_company_id_page_pk" PRIMARY KEY("company_id","page")
);
--> statement-breakpoint
ALTER TABLE "wiki_edits" ADD CONSTRAINT "wiki_edits_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_edits" ADD CONSTRAINT "wiki_edits_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;