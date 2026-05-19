import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  put, list, del, readJson,
  eventPath, expiresAtForEvent, isExpired,
  type EventMeta,
} from './_blob';
import { withErrorBoundary, parseBody } from './_handler';

// ─────────────────────────────────────────────────────────────
//  /api/event
//   - POST: promoter publishes/refreshes an event's metadata so the
//           public form can render its title/date/venue. Body is the
//           EventMeta payload; the `token` field is the key.
//   - GET  ?token=X: public endpoint that returns the event metadata
//                    so the registration form can show "you're
//                    signing up for X on Y at Z".
//
//  No native TTL with Blob — we embed `expiresAt` in the JSON and
//  drop expired blobs lazily on the next read.
// ─────────────────────────────────────────────────────────────

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Fail fast and loud if the Blob token isn't configured — otherwise the
  // SDK throws a cryptic "Vercel Blob: No token found" deep inside put().
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({
      error: 'BLOB_READ_WRITE_TOKEN missing — connect a Blob store to this project',
    });
  }

  if (req.method === 'POST') {
    const body = parseBody<EventMeta>(req.body);
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
      expiresAt: expiresAtForEvent(body.eventDate ?? null),
    };
    // `allowOverwrite` lets us refresh the event metadata on edits
    // without having to del() first. `addRandomSuffix: false` keeps
    // the path stable so reads via `list({ prefix })` are deterministic.
    await put(eventPath(meta.token), JSON.stringify(meta), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const token = String(req.query.token ?? '');
    if (!token) return res.status(400).json({ error: 'token is required' });

    const { blobs } = await list({ prefix: eventPath(token), limit: 1 });
    if (!blobs.length) return res.status(404).json({ error: 'event not found' });

    const meta = await readJson<EventMeta>(blobs[0].url);
    if (!meta) return res.status(404).json({ error: 'event not found' });

    if (isExpired(meta)) {
      // Lazy GC: free the blob now that we know it's stale.
      await del(blobs[0].url).catch(() => { /* best-effort */ });
      return res.status(404).json({ error: 'event expired' });
    }
    return res.status(200).json(meta);
  }

  return res.status(405).json({ error: 'method not allowed' });
});
