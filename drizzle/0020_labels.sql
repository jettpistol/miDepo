CREATE TABLE "label_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"kind" text NOT NULL,
	"reference" text NOT NULL,
	"source" text NOT NULL,
	"labels" jsonb NOT NULL,
	"total" integer NOT NULL,
	"automatic" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prints" integer DEFAULT 0 NOT NULL,
	"printed_at" timestamp with time zone,
	"printed_by" integer,
	"discarded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "print_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"job_id" integer,
	"printer_id" integer,
	"workstation_id" integer,
	"kind" text NOT NULL,
	"size_id" text NOT NULL,
	"labels" integer NOT NULL,
	"content" jsonb NOT NULL,
	"program" text,
	"error" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"connection" text NOT NULL,
	"language" text NOT NULL,
	"dpi" integer DEFAULT 203 NOT NULL,
	"model" text,
	"fault" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workstation_printers" (
	"workstation_id" integer NOT NULL,
	"kind" text NOT NULL,
	"printer_id" integer,
	"size_id" text NOT NULL,
	CONSTRAINT "workstation_printers_workstation_id_kind_pk" PRIMARY KEY("workstation_id","kind")
);
--> statement-breakpoint
CREATE TABLE "workstations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"token" text NOT NULL,
	"name" text NOT NULL,
	"agent" text,
	"last_user_id" integer,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "test_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "label_jobs" ADD CONSTRAINT "label_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_jobs" ADD CONSTRAINT "label_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_jobs" ADD CONSTRAINT "label_jobs_printed_by_users_id_fk" FOREIGN KEY ("printed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_log" ADD CONSTRAINT "print_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_log" ADD CONSTRAINT "print_log_job_id_label_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."label_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_log" ADD CONSTRAINT "print_log_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_log" ADD CONSTRAINT "print_log_workstation_id_workstations_id_fk" FOREIGN KEY ("workstation_id") REFERENCES "public"."workstations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_log" ADD CONSTRAINT "print_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workstation_printers" ADD CONSTRAINT "workstation_printers_workstation_id_workstations_id_fk" FOREIGN KEY ("workstation_id") REFERENCES "public"."workstations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workstation_printers" ADD CONSTRAINT "workstation_printers_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workstations" ADD CONSTRAINT "workstations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workstations" ADD CONSTRAINT "workstations_last_user_id_users_id_fk" FOREIGN KEY ("last_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "label_jobs_company_id_printed_at_idx" ON "label_jobs" USING btree ("company_id","printed_at");--> statement-breakpoint
CREATE INDEX "print_log_company_id_printer_id_idx" ON "print_log" USING btree ("company_id","printer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "printers_company_id_name_idx" ON "printers" USING btree ("company_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "workstations_company_id_token_idx" ON "workstations" USING btree ("company_id","token");