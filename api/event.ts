import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv, eventKey, ttlForEvent, type EventMeta } from './_kv';

// ─────────────────────────────────────────────────────────────
//  /api/event
//   - POST: promoter publishes/refreshes an event's metadata so the
//           public form can render its title/date/venue. Body is the
//           EventMeta payload; the `token` field is the key.
//   - GET  ?token=X: public endpoint that returns the event metadata
//                    so the registration form can show "you're
//                    signing up for X on Y at Z".
// ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Permissive CORS so the public form (potentially hosted on a
  // different domain in the future) and the promoter app can both call.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Partial<EventMeta>;
    if (!body.token || !body.name) {
      return res.status(400).json({ error: 'token and name are required' });
    }
    const meta: EventMeta = {
      token: body.token,
      name: body.name,
      eventDate: body.eventDate ?? null,
      venueName: body.venueName ?? null,
      capacity: body.capacity ?? null,
      createdAt: new Date().toISOString(),
    };
    await kv.set(eventKey(meta.token), meta, { ex: ttlForEvent(meta.eventDate) });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const token = String(req.query.token ?? '');
    if (!token) return res.status(400).json({ error: 'token is required' });
    const meta = await kv.get<EventMeta>(eventKey(token));
    if (!meta) return res.status(404).json({ error: 'event not found or expired' });
    return res.status(200).json(meta);
  }

  return res.status(405).json({ error: 'method not allowed' });
}
