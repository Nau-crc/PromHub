// ─────────────────────────────────────────────────────────────
//  /api/registration — public submission endpoint backed by Postgres.
//
//    - POST: anyone with an event's share token can submit their
//      name/handle/notes. We look up the event row by share token,
//      validate it exists, then INSERT into the `submissions` table.
//    - GET ?token=<uuid>: the promoter's app pulls all submissions
//      for an event so it can offer them as guests-to-import. We
//      filter by the event id (looked up from the token).
//
//  Previously stored in Vercel Blob — now first-class rows so we
//  can join, dedupe, and mark `imported_at` on the server later.
// ─────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAX_NAME = 80;
const MAX_HANDLE = 60;
const MAX_NOTES = 280;
const MAX_PAX = 20;
const MAX_SUBMISSIONS_LIST = 500;

interface IncomingSubmission {
  token?: string;
  name?: string;
  pax?: number | string;
  igHandle?: string;
  igPlatform?: string;
  notes?: string;
  /** yyyy-mm-dd. The specific event occurrence this sign-up is for. */
  eventDate?: string;
  /** Vercel Blob URLs previously uploaded via /api/v1/photos. Empty
   *  unless the event has `photoCount` set on it. */
  photos?: string[];
}

function parseBody<T = Record<string, unknown>>(body: unknown): Partial<T> {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body) as Partial<T>; } catch { return {}; }
  }
  if (typeof body === 'object') return body as Partial<T>;
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Lazy imports keep cold-start failures (bad env, broken module
    // graph) inside the catch block so they surface as JSON, not as
    // an opaque FUNCTION_INVOCATION_FAILED.
    const { eq, asc } = await import('drizzle-orm');
    const { db, schema } = await import('./_lib/db.js');

    if (req.method === 'POST') {
      const body = parseBody<IncomingSubmission>(req.body);
      const token = String(body.token ?? '').trim();
      if (!token) return res.status(400).json({ error: 'token is required' });

      // Look up the event by share token — the only thing tying a
      // public submission back to a real event row. Also pulls the
      // event's own date + isOneTime + venueId so we can pin the
      // submission to the right occurrence AND mirror it straight
      // into the guests table (so the promoter sees the new guest
      // without having to tap "Refresh").
      const [eventRow] = await db
        .select({
          id: schema.events.id,
          venueId: schema.events.venueId,
          eventDate: schema.events.eventDate,
          isOneTime: schema.events.isOneTime,
          // Per-night capacity moved off the events table in 0008 —
          // it's now the sum of `timeslots[].guestCapacity` for the
          // event. We pull the timeslots and reduce in JS.
          timeslots: schema.events.timeslots,
        })
        .from(schema.events)
        .where(eq(schema.events.shareToken, token))
        .limit(1);
      if (!eventRow) return res.status(404).json({ error: 'event not found' });
      // Derive a single `event` view with the same shape the rest of
      // this handler expects (a `capacity` number), so the downstream
      // waitlist/response logic doesn't need to know about the model
      // change.
      const derivedCapacity = (eventRow.timeslots ?? []).reduce(
        (sum, slot) => sum + (slot.guestCapacity || 0),
        0,
      );
      const event = {
        id: eventRow.id,
        venueId: eventRow.venueId,
        eventDate: eventRow.eventDate,
        isOneTime: eventRow.isOneTime,
        capacity: derivedCapacity > 0 ? derivedCapacity : null,
      };

      const name = String(body.name ?? '').trim().slice(0, MAX_NAME);
      if (!name) return res.status(400).json({ error: 'name is required' });

      const pax = Math.max(1, Math.min(MAX_PAX, Math.floor(Number(body.pax) || 1)));
      const igHandle = String(body.igHandle ?? '').trim().replace(/^@+/, '').slice(0, MAX_HANDLE);
      const igPlatform = body.igPlatform === 'tiktok' ? 'tiktok' : 'instagram';
      const notes = String(body.notes ?? '').trim().slice(0, MAX_NOTES);
      // Photos must be Vercel Blob URLs the client already uploaded
      // via /api/v1/photos. We accept up to 10 and trust the URL host
      // (validating beyond shape would require a HEAD per blob).
      const incomingPhotos = Array.isArray(body.photos) ? body.photos : [];
      const photos = incomingPhotos
        .filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u))
        .slice(0, 10);

      // Pick the occurrence the submission should belong to:
      //   - one-time event → always the event's own date
      //   - recurring     → the client-provided ISO date (validated)
      const incomingDate = String(body.eventDate ?? '').trim();
      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(incomingDate);
      const submissionDate: string | null = event.isOneTime
        ? (event.eventDate ?? null)
        : (isIsoDate ? incomingDate : null);

      // ── Waitlist decision ────────────────────────────────────
      // If the event has a capacity and the new pax would push the
      // already-confirmed total over it, this registration lands on
      // the waitlist. Confirmed = guests on this event + date that
      // are NOT cancelled and NOT already waitlisted.
      let waitlisted = false;
      let queuePosition: number | null = null;
      let capacityFreeBefore = Number.POSITIVE_INFINITY;
      if (event.capacity && event.capacity > 0) {
        const { sql: rawSql } = await import('drizzle-orm');
        const dateMatch = submissionDate
          ? rawSql`(event_date IS NULL OR event_date = ${submissionDate})`
          : rawSql`true`;
        // Confirmed pax (not waitlisted, not cancelled-for-main).
        // For public-form submissions we always treat the link as
        // the main event (clubEventId not involved here).
        const confirmedRows = await db
          .select({
            pax: schema.guests.pax,
            waitlisted: schema.guests.waitlisted,
            cancelled: schema.guests.cancelled,
          })
          .from(schema.guests)
          .where(rawSql`event_id = ${event.id} AND ${dateMatch}`);
        const confirmedPax = confirmedRows
          .filter((g) => !g.waitlisted && !g.cancelled)
          .reduce((a, g) => a + g.pax, 0);
        capacityFreeBefore = event.capacity - confirmedPax;
        if (confirmedPax + pax > event.capacity) {
          waitlisted = true;
          // Position = number of existing waitlisted entries + 1.
          const waitingCount = confirmedRows.filter(
            (g) => g.waitlisted && !g.cancelled,
          ).length;
          queuePosition = waitingCount + 1;
        }
      }

      const [row] = await db
        .insert(schema.submissions)
        .values({
          eventId: event.id,
          eventDate: submissionDate,
          name,
          pax,
          igHandle,
          igPlatform,
          notes,
          photos,
        })
        .returning({ id: schema.submissions.id });
      const submissionId = String(row.id);

      // Mirror the submission as a guest row right now. The guest is
      // dedup'd by `submission_id`, so if the public form is ever
      // retried (network blip + resubmit) we'd insert another
      // submission row but skip a duplicate guest. The promoter then
      // sees the new guest on their next poll — no manual import.
      try {
        const { ensureSharedTenant, SHARED_TENANT_ID } = await import('./_lib/tenancy.js');
        await ensureSharedTenant();
        const existing = await db
          .select({ id: schema.guests.id })
          .from(schema.guests)
          .where(eq(schema.guests.submissionId, submissionId))
          .limit(1);
        if (!existing.length) {
          await db.insert(schema.guests).values({
            tenantId: SHARED_TENANT_ID,
            name,
            eventId: event.id,
            venueId: event.venueId,
            pax,
            igHandle,
            igPlatform,
            // Guests submitted via the public form pick a date but
            // don't choose timeslots — the promoter can edit afterwards.
            timeslotIds: [],
            timeslotNames: [],
            eventDate: submissionDate,
            submissionId,
            notes: notes || null,
            waitlisted,
            photos,
          });
        }
      } catch (mirrorErr) {
        // Don't fail the public submission if the guest mirror fails
        // — the submission is still recorded and the promoter can
        // pull it via the legacy refresh path as a fallback.
        console.error('[api/registration] guest-mirror failed:', mirrorErr);
      }

      return res.status(200).json({
        ok: true,
        id: submissionId,
        waitlisted,
        queuePosition,
        // Capacity context for the client confirmation screen.
        capacity: event.capacity ?? null,
        // For UX copy ("there were X spots left when you submitted").
        // Negative means full when she registered.
        spotsLeftBefore: Number.isFinite(capacityFreeBefore)
          ? Math.max(0, capacityFreeBefore)
          : null,
      });
    }

    if (req.method === 'GET') {
      const token = String(req.query.token ?? '').trim();
      if (!token) return res.status(400).json({ error: 'token is required' });

      const [event] = await db
        .select({ id: schema.events.id })
        .from(schema.events)
        .where(eq(schema.events.shareToken, token))
        .limit(1);
      // Match the previous contract: missing event → empty list, not
      // 404. Saves the client from special-casing this on refresh.
      if (!event) return res.status(200).json({ submissions: [] });

      const rows = await db
        .select({
          id: schema.submissions.id,
          eventDate: schema.submissions.eventDate,
          name: schema.submissions.name,
          pax: schema.submissions.pax,
          igHandle: schema.submissions.igHandle,
          igPlatform: schema.submissions.igPlatform,
          notes: schema.submissions.notes,
          photos: schema.submissions.photos,
          createdAt: schema.submissions.createdAt,
        })
        .from(schema.submissions)
        .where(eq(schema.submissions.eventId, event.id))
        .orderBy(asc(schema.submissions.createdAt))
        .limit(MAX_SUBMISSIONS_LIST);

      // Shape into the SubmissionDTO the frontend already speaks.
      // `id` stays a string so the existing `submissionId` column
      // (text) on `guests` doesn't need a migration.
      const submissions = rows.map((r) => ({
        id: String(r.id),
        token,
        eventDate: r.eventDate ?? null,
        name: r.name,
        pax: r.pax,
        igHandle: r.igHandle,
        igPlatform: r.igPlatform as 'instagram' | 'tiktok',
        notes: r.notes,
        photos: r.photos ?? [],
        submittedAt: r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
      }));

      return res.status(200).json({ submissions });
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('[api/registration]', err);
    const e = (err ?? {}) as { name?: string; message?: string; status?: number; stack?: string };
    return res.status(e.status ?? 500).json({
      error: e.message || 'Internal error',
      name: e.name || 'Error',
      stack: typeof e.stack === 'string'
        ? e.stack.split('\n').slice(0, 12)
        : undefined,
    });
  }
}
