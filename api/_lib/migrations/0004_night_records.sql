-- Closed-night snapshots. Each row is an immutable freeze of the
-- guests / reservations / events / venues for a calendar date,
-- plus the pre-calculated aggregates the promoter (and later, the
-- manager via XLSX export) needs.
--
-- Multiple rows per date are allowed for corrections — the UI
-- shows the latest closed_at as canonical.
--
-- One statement per chunk (separated by the breakpoint marker
-- below) because the migrator runs each through Neon's HTTP
-- driver, which only accepts ONE SQL command per call.

CREATE TABLE IF NOT EXISTS "night_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  "closed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_correction" boolean DEFAULT false NOT NULL,
  "guests_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "reservations_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "events_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "venues_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "night_records_date_idx" ON "night_records" USING btree ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "night_records_closed_at_idx" ON "night_records" USING btree ("closed_at");
