import type { Venue, PromEvent, Guest, Reservation, AppDataSnapshot } from '@/core/types';

// ─────────────────────────────────────────────────────────────
//  Typed REST client for the /api/v1 backend.
//
//  Every call:
//    - Injects X-Tenant-Id (device UUID, created lazily).
//    - Returns the inner payload (unwrapping the {venues}/{event}/
//      etc. envelope from each endpoint).
//    - Throws a `HttpError`-ish object with .status and .body so
//      the caller can render a useful message.
//
//  The DB rows shape is close to but not identical to the
//  client-side types (numerics arrive as strings, timestamps as
//  ISO instants). We normalize at the seam so the rest of the
//  app keeps using the types it already had.
// ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  // No tenant header — the backend is a single shared workspace
  // now. Every device reads/writes the same dataset.
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    throw new ApiError(res.status, extractErrorMessage(res, body), body);
  }
  return body as T;
}

// Build the best possible diagnostic string from whatever the server
// returned. Vercel's generic FUNCTION_INVOCATION_FAILED page is HTML;
// our own withErrorBoundary returns `{ error, name, issues? }` JSON.
// We try in this order: JSON.error → JSON.issues → raw text snippet →
// HTTP status code as last resort.
function extractErrorMessage(res: Response, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as { error?: string; name?: string; issues?: Array<{ path?: string; message?: string }> };
    if (obj.error) return obj.error;
    if (Array.isArray(obj.issues) && obj.issues.length) {
      return obj.issues.map((i) => `${i.path ?? '?'}: ${i.message ?? 'invalid'}`).join('; ');
    }
  }
  if (typeof body === 'string' && body.trim()) {
    // Vercel error pages contain useful titles; strip HTML tags and trim.
    const stripped = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (stripped) return `HTTP ${res.status} — ${stripped.slice(0, 200)}`;
  }
  return `HTTP ${res.status}`;
}

// ── Normalization: DB row → client type ────────────────────
function normalizeVenue(row: any): Venue {
  return {
    id: row.id,
    name: row.name,
    guestCapacity: row.guestCapacity ?? 0,
    timeslots: row.timeslots ?? [],
    vipTypes: row.vipTypes ?? [],
  };
}

function normalizeEvent(row: any): PromEvent {
  return {
    id: row.id,
    name: row.name,
    venueId: row.venueId ?? null,
    weekdays: row.weekdays ?? [],
    weekday: (row.weekdays ?? [])[0] ?? '',
    selectedSlotIds: row.selectedSlotIds ?? [],
    description: row.description ?? '',
    videoUrl: '',
    isPrivate: !!row.isPrivate,
    isLateClub: !!row.isLateClub,
    invitedGuests: row.invitedGuests ?? [],
    isOneTime: !!row.isOneTime,
    eventDate: row.eventDate,
    capacity: row.capacity,
    seasonStart: row.seasonStart,
    seasonEnd: row.seasonEnd,
    shareToken: row.shareToken,
  };
}

function normalizeGuest(row: any): Guest {
  return {
    id: row.id,
    name: row.name,
    venueId: row.venueId ?? 0,
    eventId: row.eventId,
    timeslotIds: row.timeslotIds ?? [],
    timeslotNames: row.timeslotNames ?? [],
    pax: row.pax,
    clubEventId: row.clubEventId ?? null,
    checked: !!row.checked,
    cancelled: !!row.cancelled,
    influencer: !!row.influencer,
    igHandle: row.igHandle ?? '',
    igPlatform: row.igPlatform ?? 'instagram',
    createdMonth: row.createdAt ? new Date(row.createdAt).getMonth() : new Date().getMonth(),
    createdAt: row.createdAt ? String(row.createdAt).slice(0, 10) : '',
    eventDate: row.eventDate,
    submissionId: row.submissionId,
    notes: row.notes,
  };
}

function normalizeReservation(row: any): Reservation {
  return {
    id: row.id,
    name: row.name,
    phoneCode: row.phoneCode ?? '+34',
    phoneNum: row.phoneNum ?? '',
    venueId: row.venueId,
    eventId: row.eventId ?? null,
    vipType: row.vipType ?? '',
    slotId: '', // deprecated
    time: row.time ?? '20:00',
    pax: row.pax,
    fromInvite: !!row.fromInvite,
    inviterHandle: row.inviterHandle ?? '',
    inviterPlatform: row.inviterPlatform ?? 'instagram',
    // numeric arrives as string from PG — coerce here
    commissionPct: Number(row.commissionPct),
    womanPct: Number(row.womanPct),
    commissionEarner: row.commissionEarner ?? '',
    createdAt: row.createdAt ? String(row.createdAt).slice(0, 10) : '',
    eventDate: row.eventDate,
  };
}

// ── Public API surface ─────────────────────────────────────
export const api = {
  async listAll() {
    const [v, e, g, r] = await Promise.all([
      call<{ venues: any[] }>('/venues'),
      call<{ events: any[] }>('/events'),
      call<{ guests: any[] }>('/guests'),
      call<{ reservations: any[] }>('/reservations'),
    ]);
    return {
      venues: v.venues.map(normalizeVenue),
      events: e.events.map(normalizeEvent),
      guests: g.guests.map(normalizeGuest),
      reservations: r.reservations.map(normalizeReservation),
    };
  },

  // ── venues ──
  async createVenue(input: Omit<Venue, 'id'>): Promise<Venue> {
    const { venue } = await call<{ venue: any }>('/venues', {
      method: 'POST', body: JSON.stringify(input),
    });
    return normalizeVenue(venue);
  },
  async updateVenue(id: number, input: Partial<Omit<Venue, 'id'>>): Promise<Venue> {
    const { venue } = await call<{ venue: any }>(`/venues/${id}`, {
      method: 'PATCH', body: JSON.stringify(input),
    });
    return normalizeVenue(venue);
  },
  async deleteVenue(id: number): Promise<void> {
    await call<{ ok: true }>(`/venues/${id}`, { method: 'DELETE' });
  },

  // ── events ──
  async createEvent(input: Omit<PromEvent, 'id'>): Promise<PromEvent> {
    const { event } = await call<{ event: any }>('/events', {
      method: 'POST', body: JSON.stringify(input),
    });
    return normalizeEvent(event);
  },
  async updateEvent(id: number, input: Partial<Omit<PromEvent, 'id'>>): Promise<PromEvent> {
    const { event } = await call<{ event: any }>(`/events/${id}`, {
      method: 'PATCH', body: JSON.stringify(input),
    });
    return normalizeEvent(event);
  },
  async deleteEvent(id: number): Promise<void> {
    await call<{ ok: true }>(`/events/${id}`, { method: 'DELETE' });
  },

  // ── guests ──
  async createGuest(input: Omit<Guest, 'id'>): Promise<Guest> {
    const { guest } = await call<{ guest: any }>('/guests', {
      method: 'POST', body: JSON.stringify(input),
    });
    return normalizeGuest(guest);
  },
  async updateGuest(id: number, input: Partial<Omit<Guest, 'id'>>): Promise<Guest> {
    const { guest } = await call<{ guest: any }>(`/guests/${id}`, {
      method: 'PATCH', body: JSON.stringify(input),
    });
    return normalizeGuest(guest);
  },
  async deleteGuest(id: number): Promise<void> {
    await call<{ ok: true }>(`/guests/${id}`, { method: 'DELETE' });
  },

  // ── reservations ──
  async createReservation(input: Omit<Reservation, 'id'>): Promise<Reservation> {
    const { reservation } = await call<{ reservation: any }>('/reservations', {
      method: 'POST', body: JSON.stringify(input),
    });
    return normalizeReservation(reservation);
  },
  async updateReservation(id: number, input: Partial<Omit<Reservation, 'id'>>): Promise<Reservation> {
    const { reservation } = await call<{ reservation: any }>(`/reservations/${id}`, {
      method: 'PATCH', body: JSON.stringify(input),
    });
    return normalizeReservation(reservation);
  },
  async deleteReservation(id: number): Promise<void> {
    await call<{ ok: true }>(`/reservations/${id}`, { method: 'DELETE' });
  },

  // ── First-run migration ──
  async syncSnapshot(snap: AppDataSnapshot) {
    // Re-key local IDs to clientId fields the backend expects
    return call<{
      ok: true;
      counts: { venues: number; events: number; guests: number; reservations: number };
      mapping: {
        venues: Record<number, number>;
        events: Record<number, number>;
        guests: Record<number, number>;
        reservations: Record<number, number>;
      };
    }>('/sync', {
      method: 'POST',
      body: JSON.stringify(buildSyncPayload(snap)),
    });
  },
};

function buildSyncPayload(snap: AppDataSnapshot) {
  return {
    venues: snap.venues.map((v) => ({
      clientId: v.id,
      name: v.name,
      guestCapacity: v.guestCapacity,
      timeslots: v.timeslots,
      vipTypes: v.vipTypes,
    })),
    events: snap.events.map((e) => ({
      clientId: e.id,
      venueClientId: e.venueId,
      name: e.name,
      weekdays: e.weekdays,
      selectedSlotIds: e.selectedSlotIds,
      description: e.description,
      isPrivate: e.isPrivate,
      isLateClub: e.isLateClub,
      invitedGuests: e.invitedGuests,
      isOneTime: e.isOneTime,
      eventDate: e.eventDate,
      capacity: e.capacity,
      seasonStart: e.seasonStart,
      seasonEnd: e.seasonEnd,
      shareToken: e.shareToken,
    })),
    guests: snap.guests.map((g) => ({
      clientId: g.id,
      eventClientId: g.eventId,
      venueClientId: g.venueId,
      clubEventClientId: g.clubEventId,
      name: g.name,
      timeslotIds: g.timeslotIds,
      timeslotNames: g.timeslotNames,
      pax: g.pax,
      checked: g.checked,
      cancelled: g.cancelled ?? false,
      influencer: g.influencer,
      igHandle: g.igHandle,
      igPlatform: g.igPlatform,
      notes: g.notes,
      eventDate: g.eventDate,
      submissionId: g.submissionId,
    })),
    reservations: snap.reservations.map((r) => ({
      clientId: r.id,
      venueClientId: r.venueId,
      eventClientId: r.eventId,
      name: r.name,
      phoneCode: r.phoneCode,
      phoneNum: r.phoneNum,
      vipType: r.vipType,
      time: r.time,
      pax: r.pax,
      fromInvite: r.fromInvite,
      inviterHandle: r.inviterHandle,
      inviterPlatform: r.inviterPlatform,
      commissionPct: r.commissionPct,
      womanPct: r.womanPct,
      commissionEarner: r.commissionEarner,
      eventDate: r.eventDate,
    })),
  };
}
