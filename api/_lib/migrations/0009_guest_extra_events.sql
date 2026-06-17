-- Multi-event invites: same guest can attend N events the same
-- night, on top of her existing main event + optional late-club.
--
-- For now the extras share her main `cancelled` / `checked` flags
-- (one body, multiple invitations). Per-extra flags can come later
-- if the promoter ever needs to cancel ONE of three independently.

ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "extra_event_ids" integer[] DEFAULT '{}' NOT NULL;
