-- Waitlist support. When an event hits its capacity, new
-- registrations land with `waitlisted = true` instead of being
-- rejected. The promoter sees them in a separate section in the
-- event detail and can promote them as confirmed guests when
-- someone cancels.
--
-- Per spec: queue position is NOT stored — it's computed at read
-- time from the createdAt order. That way promoting from the
-- middle of the queue doesn't require renumbering anything.

ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "waitlisted" boolean DEFAULT false NOT NULL;
