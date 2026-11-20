ALTER TABLE "users" ALTER COLUMN "list_view" SET DEFAULT 'table';--> statement-breakpoint
-- Lista becomes the default. Nobody could have chosen yet in a meaningful way (the switch shipped the same day), so everyone starts on Lista.
UPDATE "users" SET "list_view" = 'table';