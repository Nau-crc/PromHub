// ─────────────────────────────────────────────────────────────
//  /api/event — public lookup of an event by its share token.
//
//  Used by the registration form at /register/<token> to render
//  the event title, date and venue. Reads from Postgres (the
//  `events` table) — the old Blob storage has been retired.
//
//  Only the GET ?token=<uuid> shape is exposed. The previous
//  POST endpoint is gone: events are created via /api/v1/events
//  (the promoter app), and the share token already lives on the
//  event row, so there's nothing to "publish" separately.
// ─────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // POST is accepted as a no-op for backward compatibility with
    // older app builds that still call `publishEvent(...)`. Returning
    // 200 keeps them happy without doing anything — the event is
    // already in the DB. New builds shouldn't hit this anymore.
    if (req.method === 'POST') {
      return res.status(200).json({ ok: true, noop: true });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

    const token = String(req.query.token ?? '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });

    const { eq } = await import('drizzle-orm');
    const { db, schema } = await import('./_lib/db.js');
    const venueName = (await import('./_lib/db.js')).schema; // unused but loads module
    void venueName;

    const [row] = await db
      .select({
        token: schema.events.shareToken,
        name: schema.events.name,
        eventDate: schema.events.eventDate,
        capacity: schema.events.capacity,
        venueId: schema.events.venueId,
      })
      .from(schema.events)
      .where(eq(schema.events.shareToken, token))
      .limit(1);

    if (!row) return res.status(404).json({ error: 'event not found' });

    // Pull the venue name in a second tiny query so the form can show
    // "[event] at [venue]". Null-safe — events without a venue are
    // allowed (one-off private parties, etc.).
    let venueNameValue: string | null = null;
    if (row.venueId != null) {
      const [v] = await db
        .select({ name: schema.venues.name })
        .from(schema.venues)
        .where(eq(schema.venues.id, row.venueId))
        .limit(1);
      venueNameValue = v?.name ?? null;
    }

    return res.status(200).json({
      token: row.token,
      name: row.name,
      eventDate: row.eventDate,
      venueName: venueNameValue,
      capacity: row.capacity,
    });
  } catch (err) {
    console.error('[api/event]', err);
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
