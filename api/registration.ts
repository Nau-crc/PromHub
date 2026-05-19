import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  kv, eventKey, submissionKey, submissionSetKey, ttlForEvent,
  type EventMeta, type Submission,
} from './_kv';

// ─────────────────────────────────────────────────────────────
//  /api/registration
//    - POST: public. A guest submits her details for an event token.
//            Validated against the EventMeta (must exist + not
//            expired). Stored under registration:<token>:<id> and
//            indexed in the event:<token>:submissions set.
//    - GET ?token=X: returns the list of submissions for that token.
//            Same token used for write/read for simplicity in v1.
// ─────────────────────────────────────────────────────────────

function uuid(): string {
  // RFC4122 v4 (server runtime usually has globalThis.crypto)
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const MAX_NAME = 80;
const MAX_HANDLE = 60;
const MAX_NOTES = 280;
const MAX_PAX = 20;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Partial<Submission>;
    const token = body.token;
    if (!token) return res.status(400).json({ error: 'token is required' });

    // The event must exist (TTL not elapsed) before we accept submissions.
    const meta = await kv.get<EventMeta>(eventKey(token));
    if (!meta) return res.status(404).json({ error: 'event not found or expired' });

    const name = String(body.name ?? '').trim().slice(0, MAX_NAME);
    if (!name) return res.status(400).json({ error: 'name is required' });

    const sub: Submission = {
      id: uuid(),
      token,
      name,
      pax: Math.max(1, Math.min(MAX_PAX, Math.floor(Number(body.pax) || 1))),
      igHandle: String(body.igHandle ?? '').trim().replace(/^@+/, '').slice(0, MAX_HANDLE),
      igPlatform: body.igPlatform === 'tiktok' ? 'tiktok' : 'instagram',
      notes: String(body.notes ?? '').trim().slice(0, MAX_NOTES),
      submittedAt: new Date().toISOString(),
    };

    const ttl = ttlForEvent(meta.eventDate);
    await Promise.all([
      kv.set(submissionKey(token, sub.id), sub, { ex: ttl }),
      kv.sadd(submissionSetKey(token), sub.id),
      kv.expire(submissionSetKey(token), ttl),
    ]);
    return res.status(200).json({ ok: true, id: sub.id });
  }

  if (req.method === 'GET') {
    const token = String(req.query.token ?? '');
    if (!token) return res.status(400).json({ error: 'token is required' });
    const ids = (await kv.smembers(submissionSetKey(token))) as string[];
    if (!ids.length) return res.status(200).json({ submissions: [] });
    // Fetch each submission. KV doesn't have batch get of arbitrary
    // keys in the JS SDK, so this is N calls — acceptable while volume
    // is small (a few hundred per event at most).
    const subs = await Promise.all(ids.map((id) => kv.get<Submission>(submissionKey(token, id))));
    return res.status(200).json({ submissions: subs.filter(Boolean) });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
