-- Big restructure: capacity and timeslots stop being a venue
-- concern and become event-scoped.
--
-- Venue keeps: phone, vip_types (identity + capacity, no prices)
-- Event gains: timeslots (jsonb) + vip_prices (jsonb)
-- Both venue and event lose their old capacity columns — slot
-- capacity is now the granular truth, summed per night.
--
-- We DROP rather than migrate the legacy data because (a) the
-- shape change is fundamental (price moves from inside venue.vip_types
-- to event.vip_prices, slot defs move from inside venue.timeslots
-- to event.timeslots) and (b) the user is still in MVP testing
-- and prefers a clean slate over a half-translated old structure.
--
-- One statement per chunk per the migrator's HTTP-driver limit.

ALTER TABLE "venues" DROP COLUMN IF EXISTS "guest_capacity";
--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "timeslots";
--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN IF EXISTS "capacity";
--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN IF EXISTS "selected_slot_ids";
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "timeslots" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "vip_prices" jsonb DEFAULT '{}'::jsonb NOT NULL;
