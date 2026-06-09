-- A guest can carry two event links (main + late-club). Until now
-- her `cancelled` and `checked` flags applied to BOTH at once — but
-- the business rule is that the two attendances are independent
-- ("invitaciones por separado"). Adding two club-specific flags
-- so each link can be toggled on its own.
--
-- Defaults to FALSE for both — pre-existing guests keep their main
-- status untouched and start with a clean club status.
--
-- One statement per chunk so the migrator's HTTP driver doesn't
-- see multi-statement queries.

ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "checked_club" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "cancelled_club" boolean DEFAULT false NOT NULL;
