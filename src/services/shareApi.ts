// ─────────────────────────────────────────────────────────────
//  Frontend client for the public-registration backend
//  (Vercel KV + serverless functions in /api/).
//
//  All calls go to the same origin as the deployed app — Vite
//  proxies are not required because Vercel serves both the static
//  build and the /api/* functions from the same domain.
//
//  In local dev with `vite` the /api/* endpoints don't run. Use
//  `vercel dev` to spin up both the front-end and the serverless
//  functions together. See README "Local backend dev" section.
// ─────────────────────────────────────────────────────────────

export interface PublicEventMeta {
  token: string;
  name: string;
  eventDate: string | null;
  venueName: string | null;
  capacity: number | null;
}

export interface SubmissionDTO {
  id: string;
  token: string;
  name: string;
  pax: number;
  igHandle: string;
  igPlatform: 'instagram' | 'tiktok';
  notes: string;
  submittedAt: string;
}

const API_BASE = ''; // same origin

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error ?? ''; } catch { /* */ }
    throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
  }
  return res.json() as Promise<T>;
}

// NOTE: `publishEvent` is gone. Events live in Postgres with the
// share token on the row itself, so saving an event IS the publish.
// The /api/event POST endpoint still returns 200 for backward compat
// with old app builds that called it, but new code shouldn't.

/** Public side: fetch event metadata so the form can prefill. */
export const fetchEvent = (token: string): Promise<PublicEventMeta> =>
  jsonFetch(`/api/event?token=${encodeURIComponent(token)}`);

/** Public side: submit a registration. */
export const submitRegistration = (
  payload: Omit<SubmissionDTO, 'id' | 'submittedAt'>,
): Promise<{ ok: true; id: string }> =>
  jsonFetch('/api/registration', { method: 'POST', body: JSON.stringify(payload) });

/** Promoter side: list all submissions for an event token. */
export const listSubmissions = (token: string): Promise<{ submissions: SubmissionDTO[] }> =>
  jsonFetch(`/api/registration?token=${encodeURIComponent(token)}`);

/** Make a registration URL the promoter can share. */
export const buildShareUrl = (token: string): string => {
  if (typeof window === 'undefined') return `/register/${token}`;
  return `${window.location.origin}/register/${token}`;
};
