import { kv } from '@vercel/kv';

// ─────────────────────────────────────────────────────────────
//  Shared KV access layer for the public-registration feature.
//
//  Key layout (one token per event):
//    event:<token>                  → EventMeta JSON, TTL = eventDate + 1d
//    registration:<token>:<subId>   → Submission JSON, TTL = eventDate + 1d
//    event:<token>:submissions      → set of submission IDs (so we can list
//                                     without scanning, also TTL'd)
//
//  We rely on Vercel KV's built-in TTL so we never need a cleanup job —
//  once the event date passes (+24h grace) every key tied to that token
//  disappears on its own.
// ─────────────────────────────────────────────────────────────

export interface EventMeta {
  token: string;
  name: string;
  eventDate: string | null;   // ISO yyyy-mm-dd
  venueName: string | null;
  capacity: number | null;
  createdAt: string;          // ISO instant
}

export interface Submission {
  id: string;                 // server-assigned UUID
  token: string;
  name: string;
  pax: number;
  igHandle: string;
  igPlatform: 'instagram' | 'tiktok';
  notes: string;
  submittedAt: string;        // ISO instant
}

const ONE_DAY = 60 * 60 * 24;

/** Compute the TTL (in seconds) so the data disappears the day after the event. */
export function ttlForEvent(eventDate: string | null): number {
  if (!eventDate) return ONE_DAY * 30; // open-ended → 30 days
  const [y, m, d] = eventDate.split('-').map(Number);
  const event = new Date(y, m - 1, d).getTime();
  const expires = event + ONE_DAY * 1000 * 1; // +1 day
  const seconds = Math.floor((expires - Date.now()) / 1000);
  return Math.max(ONE_DAY, seconds); // at least 1 day from now
}

export const eventKey = (token: string) => `event:${token}`;
export const submissionKey = (token: string, subId: string) => `registration:${token}:${subId}`;
export const submissionSetKey = (token: string) => `event:${token}:submissions`;

export { kv };
