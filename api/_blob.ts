import { put, list, del } from '@vercel/blob';

// ─────────────────────────────────────────────────────────────
//  Shared Vercel Blob layer for the public-registration feature.
//
//  Why Blob (not KV / Redis):
//    Vercel KV requires a paid plan now; Blob is on the free tier.
//    Trade-off: Blob has no native TTL, so we embed an `expiresAt`
//    timestamp in each JSON document and check it on read (lazy
//    expiry). On expiry we delete the blob inline to free space.
//    A scheduled function could sweep stale blobs more aggressively
//    later if needed — for now lazy expiry is sufficient because:
//      • reads are the most frequent path
//      • storage is cheap (~bytes per event/submission)
//
//  Path layout (one token per event):
//    events/<token>.json                 → EventMeta
//    registrations/<token>/<subId>.json  → Submission
//
//  Both blobs are `access: 'public'`. Their URLs are unpredictable
//  (random store prefix) AND the token itself is a UUIDv4 — same
//  security guarantee we had under KV (token = secret).
// ─────────────────────────────────────────────────────────────

export interface ExpirableRecord {
  expiresAt: string; // ISO instant
}

export interface EventMeta extends ExpirableRecord {
  token: string;
  name: string;
  eventDate: string | null;   // ISO yyyy-mm-dd
  venueName: string | null;
  capacity: number | null;
  createdAt: string;          // ISO instant
}

export interface Submission extends ExpirableRecord {
  id: string;
  token: string;
  name: string;
  pax: number;
  igHandle: string;
  igPlatform: 'instagram' | 'tiktok';
  notes: string;
  submittedAt: string;
}

const ONE_DAY_MS = 1000 * 60 * 60 * 24;
const DEFAULT_OPEN_ENDED_DAYS = 30;

/** When does this event's data expire? eventDate + 24h, or +30 days for open-ended. */
export function expiresAtForEvent(eventDate: string | null): string {
  if (!eventDate) {
    return new Date(Date.now() + ONE_DAY_MS * DEFAULT_OPEN_ENDED_DAYS).toISOString();
  }
  const [y, m, d] = eventDate.split('-').map(Number);
  const t = new Date(y, m - 1, d).getTime() + ONE_DAY_MS;
  // Never give a TTL in the past — at least 1 day of life.
  return new Date(Math.max(t, Date.now() + ONE_DAY_MS)).toISOString();
}

export const isExpired = (r: ExpirableRecord): boolean =>
  new Date(r.expiresAt).getTime() < Date.now();

/** Blob path helpers — pure, no I/O. */
export const eventPath = (token: string) => `events/${token}.json`;
export const submissionPrefix = (token: string) => `registrations/${token}/`;
export const submissionPath = (token: string, id: string) =>
  `${submissionPrefix(token)}${id}.json`;

/** Fetch a public blob and parse its JSON. Returns null on any failure. */
export async function readJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export { put, list, del };
