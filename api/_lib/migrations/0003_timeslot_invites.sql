-- Collapse the legacy "invitation type" concept into timeslots.
--
-- A venue's `invite_types` jsonb is dropped entirely. Each guest now
-- picks from the event's selected timeslots instead — same shape
-- (list of name chips) so the UI / display logic stays identical.
--
-- The old `invite_type_ids` and `invite_type_names` columns on
-- guests are dropped; new `timeslot_ids` / `timeslot_names`
-- columns take their place. We do NOT migrate existing data
-- because the IDs were drawn from a different namespace (`inv…`
-- vs `ts…`) and there was no semantic mapping — they need to be
-- re-selected per guest. Acceptable since this is an MVP-stage
-- concept replacement, not a rename.
--
-- One statement per "--> statement-breakpoint" chunk because the
-- migrator runs each chunk through Neon's HTTP driver, which only
-- accepts a single SQL command per call.

ALTER TABLE "guests" DROP COLUMN IF EXISTS "invite_type_ids";
--> statement-breakpoint
ALTER TABLE "guests" DROP COLUMN IF EXISTS "invite_type_names";
--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "timeslot_ids" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "timeslot_names" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "invite_types";
