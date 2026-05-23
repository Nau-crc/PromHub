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
      // event's own date + isOneTime so we can pin the submission
      // to the right occurrence even if the client omits the field.
      const [event] = await db
        .select({
          id: schema.events.id,
          eventDate: schema.events.eventDate,
          isOneTime: schema.events.isOneTime,
        })
        .from(schema.events)
        .where(eq(schema.events.shareToken, token))
        .limit(1);
      if (!event) return res.status(404).json({ error: 'event not found' });

      const name = String(body.name ?? '').trim().slice(0, MAX_NAME);
      if (!name) return res.status(400).json({ error: 'name is required' });

      const pax = Math.max(1, Math.min(MAX_PAX, Math.floor(Number(body.pax) || 1)));
      const igHandle = String(body.igHandle ?? '').trim().replace(/^@+/, '').slice(0, MAX_HANDLE);
      const igPlatform = body.igPlatform === 'tiktok' ? 'tiktok' : 'instagram';
      const notes = String(body.notes ?? '').trim().slice(0, MAX_NOTES);

      // Pick the occurrence the submission should belong to:
      //   - one-time event → always the event's own date
      //   - recurring     → the client-provided ISO date (validated)
      const incomingDate = String(body.eventDate ?? '').trim();
      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(incomingDate);
      const submissionDate: string | null = event.isOneTime
        ? (event.eventDate ?? null)
        : (isIsoDate ? incomingDate : null);

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
        })
        .returning({ id: schema.submissions.id });

      return res.status(200).json({ ok: true, id: String(row.id) });
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
