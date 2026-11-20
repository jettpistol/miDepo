ALTER TABLE "pick_tasks" ADD COLUMN "sent_to_missing" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pick_tasks" ADD COLUMN "replaces_task_id" integer;