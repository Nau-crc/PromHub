import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  put, list, del, readJson,
  eventPath, submissionPath, submissionPrefix,
  isExpired,
  type EventMeta, type Submission,
} from './_blob';

// ─────────────────────────────────────────────────────────────
//  /api/registration
//    - POST: public. A guest submits her details for an event token.
//            We first verify the event blob exists and isn't expired,
//            then store the submission alongside.
//    - GET ?token=X: returns the list of non-expired submissions
//            for that token. Same token used for write/read in v1.
// ─────────────────────────────────────────────────────────────

function uuid(): string {
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
const MAX_SUBMISSIONS_LIST = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Partial<Submission>;
    const token = body.token;
    if (!token) return res.status(400).json({ error: 'token is required' });

    // The event must exist and be in-window before we accept a submission.
    const { blobs: eventBlobs } = await list({ prefix: eventPath(token), limit: 1 });
    if (!eventBlobs.length) return res.status(404).json({ error: 'event not found' });
    const eventMeta = await readJson<EventMeta>(eventBlobs[0].url);
    if (!eventMeta) return res.status(404).json({ error: 'event not found' });
    if (isExpired(eventMeta)) {
      await del(eventBlobs[0].url).catch(() => {});
      return res.status(410).json({ error: 'event expired' });
    }

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
      expiresAt: eventMeta.expiresAt, // inherit event's expiry window
    };

    await put(submissionPath(token, sub.id), JSON.stringify(sub), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    return res.status(200).json({ ok: true, id: sub.id });
  }

  if (req.method === 'GET') {
    const token = String(req.query.token ?? '');
    if (!token) return res.status(400).json({ error: 'token is required' });

    const { blobs } = await list({
      prefix: submissionPrefix(token),
      limit: MAX_SUBMISSIONS_LIST,
    });
    if (!blobs.length) return res.status(200).json({ submissions: [] });

    // Fetch all in parallel — they're small JSON blobs.
    const parsed = await Promise.all(blobs.map(async (b) => {
      const sub = await readJson<Submission>(b.url);
      return sub ? { sub, url: b.url } : null;
    }));

    const active: Submission[] = [];
    const expiredUrls: string[] = [];
    for (const item of parsed) {
      if (!item) continue;
      if (isExpired(item.sub)) expiredUrls.push(item.url);
      else active.push(item.sub);
    }
    // Lazy GC of expired submissions — fire-and-forget.
    if (expiredUrls.length) {
      Promise.all(expiredUrls.map((u) => del(u).catch(() => {})));
    }

    // Stable order: oldest submission first.
    active.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return res.status(200).json({ submissions: active });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
