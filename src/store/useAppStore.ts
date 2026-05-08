import { create } from 'zustand';
import type { AppDataSnapshot, Venue, PromEvent, Guest, Reservation } from '@/core/types';
import { storage } from '@/services/storage';
import { STORAGE_KEYS } from '@/core/constants';

interface AppState extends AppDataSnapshot {
  // hydration / onboarding
  hydrated: boolean;
  onboarded: boolean;

  // hydration
  load: () => Promise<void>;
  persist: () => Promise<void>;
  setOnboarded: (v: boolean) => Promise<void>;

  // venues
  upsertVenue: (v: Venue) => void;
  removeVenue: (id: number) => void;

  // events
  upsertEvent: (e: PromEvent) => void;
  removeEvent: (id: number) => void;
  togglePrivateInvite: (eventId: number, guestName: string) => void;

  // guests
  upsertGuest: (g: Guest) => void;
  removeGuest: (id: number) => void;
  toggleArrived: (id: number) => void;

  // reservations
  upsertReservation: (r: Reservation) => void;
  removeReservation: (id: number) => void;

  // ID generation
  nextId: (kind: 'venue' | 'event' | 'guest' | 'res' | 'ts' | 'vip' | 'inv') => number | string;
}

// ─────────────────────────────────────────────────────────────
//  Forward-compatible migration. Records persisted by older
//  versions of the app may be missing fields added later
//  (createdAt, eventDate, isOneTime, capacity, season ranges).
//  We fill them in with sensible defaults so the rest of the
//  code can assume the new shape without null checks everywhere.
// ─────────────────────────────────────────────────────────────
function migrateSnapshot(snap: AppDataSnapshot): AppDataSnapshot {
  const events = (snap.events || []).map((e) => ({
    ...e,
    isOneTime: e.isOneTime ?? false,
    eventDate: e.eventDate ?? null,
    capacity: e.capacity ?? null,
    seasonStart: e.seasonStart ?? null,
    seasonEnd: e.seasonEnd ?? null,
    weekdays: e.weekdays ?? (e.weekday ? [e.weekday] : []),
    invitedGuests: e.invitedGuests ?? [],
  }));
  const eventById = new Map(events.map((e) => [e.id, e]));
  // Backfill `eventDate` on old guests/reservations:
  //  - linked to a one-time event → use that event's date
  //  - linked to a recurring event → use createdAt as best-effort guess
  //  - unlinked → null
  const guests = (snap.guests || []).map((g) => {
    if (g.eventDate !== undefined && g.eventDate !== null) return g;
    let eventDate: string | null = null;
    if (g.eventId != null) {
      const ev = eventById.get(g.eventId);
      eventDate = ev?.isOneTime ? ev.eventDate : (g.createdAt || null);
    }
    return { ...g, eventDate, createdAt: g.createdAt || '' };
  });
  const reservations = (snap.reservations || []).map((r) => {
    if (r.eventDate !== undefined && r.eventDate !== null) return r;
    let eventDate: string | null = null;
    if (r.eventId != null) {
      const ev = eventById.get(r.eventId);
      eventDate = ev?.isOneTime ? ev.eventDate : (r.createdAt || null);
    }
    return { ...r, eventDate, createdAt: r.createdAt || '' };
  });
  return { ...snap, events, guests, reservations };
}

const emptyState: AppDataSnapshot = {
  venues: [],
  events: [],
  guests: [],
  reservations: [],
  nextVenueId: 1,
  nextEventId: 1,
  nextGuestId: 1,
  nextResId: 1,
  nextTsId: 100,
  nextVipId: 200,
  invTypeNextId: 300,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...emptyState,
  hydrated: false,
  onboarded: false,

  load: async () => {
    const snap = await storage.get<AppDataSnapshot>(STORAGE_KEYS.state);
    const onboarded = (await storage.get<boolean>(STORAGE_KEYS.onboarded)) ?? false;
    const hydrated = snap ? migrateSnapshot(snap) : emptyState;
    set({ ...hydrated, hydrated: true, onboarded });
  },

  persist: async () => {
    const s = get();
    const snap: AppDataSnapshot = {
      venues: s.venues,
      events: s.events,
      guests: s.guests,
      reservations: s.reservations,
      nextVenueId: s.nextVenueId,
      nextEventId: s.nextEventId,
      nextGuestId: s.nextGuestId,
      nextResId: s.nextResId,
      nextTsId: s.nextTsId,
      nextVipId: s.nextVipId,
      invTypeNextId: s.invTypeNextId,
    };
    await storage.set(STORAGE_KEYS.state, snap);
  },

  setOnboarded: async (v) => {
    set({ onboarded: v });
    await storage.set(STORAGE_KEYS.onboarded, v);
  },

  nextId: (kind) => {
    const s = get();
    if (kind === 'venue') { set({ nextVenueId: s.nextVenueId + 1 }); return s.nextVenueId; }
    if (kind === 'event') { set({ nextEventId: s.nextEventId + 1 }); return s.nextEventId; }
    if (kind === 'guest') { set({ nextGuestId: s.nextGuestId + 1 }); return s.nextGuestId; }
    if (kind === 'res')   { set({ nextResId:   s.nextResId   + 1 }); return s.nextResId; }
    if (kind === 'ts')    { set({ nextTsId:    s.nextTsId    + 1 }); return 'ts' + s.nextTsId; }
    if (kind === 'vip')   { set({ nextVipId:   s.nextVipId   + 1 }); return 'vip' + s.nextVipId; }
    /* inv */              { set({ invTypeNextId: s.invTypeNextId + 1 }); return 'inv' + s.invTypeNextId; }
  },

  upsertVenue: (v) => {
    set((s) => {
      const i = s.venues.findIndex((x) => x.id === v.id);
      const venues = i >= 0 ? s.venues.map((x) => x.id === v.id ? v : x) : [...s.venues, v];
      return { venues };
    });
    get().persist();
  },

  removeVenue: (id) => {
    set((s) => ({ venues: s.venues.filter((x) => x.id !== id) }));
    get().persist();
  },

  upsertEvent: (e) => {
    set((s) => {
      const i = s.events.findIndex((x) => x.id === e.id);
      const events = i >= 0 ? s.events.map((x) => x.id === e.id ? e : x) : [...s.events, e];
      return { events };
    });
    get().persist();
  },

  removeEvent: (id) => {
    set((s) => ({ events: s.events.filter((x) => x.id !== id) }));
    get().persist();
  },

  togglePrivateInvite: (eventId, guestName) => {
    set((s) => ({
      events: s.events.map((e) => {
        if (e.id !== eventId) return e;
        const arr = e.invitedGuests || [];
        const i = arr.indexOf(guestName);
        const invitedGuests = i >= 0
          ? arr.filter((_, idx) => idx !== i)
          : [...arr, guestName];
        return { ...e, invitedGuests };
      }),
    }));
    get().persist();
  },

  upsertGuest: (g) => {
    set((s) => {
      const i = s.guests.findIndex((x) => x.id === g.id);
      const guests = i >= 0 ? s.guests.map((x) => x.id === g.id ? g : x) : [...s.guests, g];
      return { guests };
    });
    get().persist();
  },

  removeGuest: (id) => {
    set((s) => ({ guests: s.guests.filter((x) => x.id !== id) }));
    get().persist();
  },

  toggleArrived: (id) => {
    set((s) => ({
      guests: s.guests.map((g) => g.id === id ? { ...g, checked: !g.checked } : g),
    }));
    get().persist();
  },

  upsertReservation: (r) => {
    set((s) => {
      const i = s.reservations.findIndex((x) => x.id === r.id);
      const reservations = i >= 0
        ? s.reservations.map((x) => x.id === r.id ? r : x)
        : [...s.reservations, r];
      return { reservations };
    });
    get().persist();
  },

  removeReservation: (id) => {
    set((s) => ({ reservations: s.reservations.filter((x) => x.id !== id) }));
    get().persist();
  },
}));
