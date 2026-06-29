// ─────────────────────────────────────────────────────────────
//  Frontend client for the public-registration backend
//  (Neon Postgres via serverless functions in /api/).
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
  /** Free-form event description, rendered on the thanks page after
   *  a successful submission ("Remember: <description>"). Empty
   *  string when the promoter didn't write one. */
  description: string;
  /** The specific occurrence date the link is for (yyyy-mm-dd).
   *  One-time events: matches the event's own date. Recurring
   *  events: the date the promoter pinned in the share URL. */
  eventDate: string | null;
  /** True when the event has a fixed single date (no recurrence). */
  isOneTime: boolean;
  venueName: string | null;
  capacity: number | null;
  /** When set, the event requires this many photos per guest at the
   *  door; the form surfaces an upload section and blocks submit until
   *  every slot is filled. */
  photoCount: number | null;
}

export interface SubmissionDTO {
  id: string;
  token: string;
  /** Occurrence date the sign-up was made for (yyyy-mm-dd). */
  eventDate: string | null;
  name: string;
  pax: number;
  igHandle: string;
  igPlatform: 'instagram' | 'tiktok';
  notes: string;
  /** Vercel Blob URLs the public form uploaded for this submission. */
  photos: string[];
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
export const fetchEvent = (token: string, date?: string | null): Promise<PublicEventMeta> => {
  const q = new URLSearchParams({ token });
  if (date) q.set('date', date);
  return jsonFetch(`/api/event?${q.toString()}`);
};

export interface SubmitResponse {
  ok: true;
  id: string;
  /** True when the event was full at the time of submission and she
   *  landed on the waitlist instead. */
  waitlisted: boolean;
  /** 1-based position in the waitlist when `waitlisted = true`. */
  queuePosition: number | null;
  /** Event capacity at the time of submission; null if unlimited. */
  capacity: number | null;
  /** How many spots were free RIGHT BEFORE this submission. 0 means
   *  full when she submitted; null = no capacity configured. */
  spotsLeftBefore: number | null;
}

/** Public side: submit a registration. */
export const submitRegistration = (
  payload: Omit<SubmissionDTO, 'id' | 'submittedAt'>,
): Promise<SubmitResponse> =>
  jsonFetch('/api/registration', { method: 'POST', body: JSON.stringify(payload) });

/** Promoter side: list all submissions for an event token. */
export const listSubmissions = (token: string): Promise<{ submissions: SubmissionDTO[] }> =>
  jsonFetch(`/api/registration?token=${encodeURIComponent(token)}`);

/** Make a registration URL the promoter can share. The optional
 *  `date` query pin tells the public form which occurrence it's
 *  for (required for recurring events; ignored for one-time ones). */
export const buildShareUrl = (token: string, date?: string | null): string => {
  const path = date ? `/register/${token}?d=${encodeURIComponent(date)}` : `/register/${token}`;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
};

// ─── /plan flow ─────────────────────────────────────────────
//  Public, multi-event sign-up. The promoter shares ONE link per
//  night (or just /plan and the public form defaults to today).
//  /api/v1/today returns the events; /api/v1/plan-register takes
//  the picks and creates one guest row per chosen event.

/** Trimmed event payload the public /plan flow needs. No tenancy
 *  data; only what's safe to show to anonymous guests. */
export interface PlanEvent {
  id: number;
  name: string;
  description: string;
  venueId: number | null;
  venueName: string | null;
  timeslots: Array<{
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    guestCapacity: number;
  }>;
  photoCount: number | null;
  flyerUrl: string | null;
  /** Per-event price per VIP type name. Used by the reservation
   *  flow to render the table picker; empty when none configured. */
  vipPrices: Record<string, number>;
  /** Venue-side VIP type definitions (identity + pax range +
   *  capacity). Empty when the venue has no VIPs configured or
   *  the event has no venue at all. */
  venueVipTypes: Array<{
    id: string;
    name: string;
    minPax: number;
    maxPax: number;
    tableCapacity: number;
  }>;
}

export interface TodayResponse {
  date: string;
  events: PlanEvent[];
}

export const fetchToday = (date?: string | null): Promise<TodayResponse> => {
  const q = date ? `?d=${encodeURIComponent(date)}` : '';
  return jsonFetch(`/api/v1/today${q}`);
};

export interface PlanRegisterPayload {
  date: string;
  eventIds: number[];
  name: string;
  pax: number;
  igHandle: string;
  igPlatform: 'instagram' | 'tiktok';
  photos: string[];
  acceptedTerms: true;
  acceptedFlyerStory: true;
}

export interface PlanRegisterResult {
  eventId: number;
  eventName: string;
  waitlisted: boolean;
  queuePosition: number | null;
  flyerUrl: string | null;
}

export const planRegister = (
  payload: PlanRegisterPayload,
): Promise<{ ok: true; results: PlanRegisterResult[] }> =>
  jsonFetch('/api/v1/plan-register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/** Build the /plan share URL. Optional date pin defaults to "today
 *  on the device that opens the link" when omitted. */
export const buildPlanUrl = (date?: string | null): string => {
  const path = date ? `/plan?d=${encodeURIComponent(date)}` : '/plan';
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
};

// ─── /plan reservation flow (paid VIP table) ───────────────
export interface PlanReservePayload {
  date: string;
  venueId: number;
  eventId: number | null;
  vipType: string;
  pax: number;
  name: string;
  phoneCode: string;
  phoneNum: string;
  time: string;
}

export interface PlanReserveResult {
  ok: true;
  id: number;
  venueName: string;
  vipType: string;
  pax: number;
  priceAtBooking: number | null;
  time: string;
  date: string;
}

export const planReserve = (payload: PlanReservePayload): Promise<PlanReserveResult> =>
  jsonFetch('/api/v1/plan-reserve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
