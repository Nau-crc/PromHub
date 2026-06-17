-- Venues gain a `venue_type` text column so they can be grouped
-- into sections in the venues list ("Club", "Restaurante",
-- "Beach Club", etc.). The list of types itself is configurable
-- per workspace and lives in `tenants.settings` as a jsonb array
-- so it can grow without schema changes.
--
-- Both columns nullable / with defaults so existing rows keep
-- working unchanged.

ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "venue_type" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;
