ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "photo_count" integer;
--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "photos" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "photos" text[] DEFAULT '{}' NOT NULL;
