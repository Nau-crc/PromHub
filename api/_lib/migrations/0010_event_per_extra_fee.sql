-- Per-extra-guest bonus on top of the existing fixed fee. Once
-- the event's threshold is met, the promoter earns the fixed fee
-- PLUS this amount for each guest beyond the threshold.
--
-- Nullable so events without per-extra-bonus configured keep the
-- current behaviour (just the flat fee). Stored as numeric(8,2)
-- to match the precision of fixed_fee and reservation commissions.

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "per_extra_guest_fee" numeric(8, 2);
