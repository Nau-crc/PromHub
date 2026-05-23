-- Pin each public submission to a specific event occurrence.
-- Nullable so legacy submissions (made before this column existed)
-- continue to work. New submissions always carry it.
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "event_date" date;
