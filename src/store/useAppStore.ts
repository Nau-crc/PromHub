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
    set({ ...(snap ?? emptyState), hydrated: true, onboarded });
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
