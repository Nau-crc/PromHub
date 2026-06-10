-- Fixed-fee logic per event: the promoter earns a flat amount on
-- any occurrence where she brings at least N guests.
--
-- Both columns nullable so existing events keep working unchanged
-- (NULL = no fee logic for that event). When BOTH are set the
-- client awards the fee on dates where the pax count meets the
-- threshold; when either is NULL, no fee is computed.
--
-- One statement per chunk because the migrator's Neon HTTP driver
-- only accepts a single SQL command per call.

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "min_guests_threshold" integer;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "fixed_fee" numeric(8, 2);
