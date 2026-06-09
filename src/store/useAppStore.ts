import { create } from 'zustand';
import type {
  AppDataSnapshot, Venue, PromEvent, Guest, Reservation,
  NightRecord,
} from '@/core/types';
import { storage } from '@/services/storage';
import { STORAGE_KEYS } from '@/core/constants';
import { api } from '@/services/apiClient';
import {
  buildNightSummary, guestsForNight,
  reservationsForNight, eventsForNight,
} from '@/features/summary/nightSummary';

// ─────────────────────────────────────────────────────────────
//  App store after the backend migration.
//
//  Conceptual model:
//    - The Neon database is the source of truth.
//    - This Zustand store is a *session cache* of what we've
//      fetched. Hydration calls api.listAll() once at startup.
//    - Every mutation goes through the API; on success we patch
//      the local cache to keep the UI in sync. There's no
//      Capacitor Preferences persistence anymore — that's the
//      job of the database.
//
//  First-run migration:
//    The app may have local data from before the backend existed
//    (Capacitor Preferences under STORAGE_KEYS.state). On
//    hydration we detect this, POST the snapshot to /api/v1/sync
//    once, then drop the local key.
//
//  Offline behaviour (declared limitation):
//    Mutations require a network round-trip. If you save with no
//    connectivity, the call throws and the UI shows the error.
//    A future iteration could add an outbox queue.
// ─────────────────────────────────────────────────────────────

const MIGRATION_FLAG_KEY = 'promhub.migrated.v1';

// Local shape carried over from the public-form sync helper.
export interface PublicSubmission {
  id: string;
  /** Specific occurrence the sign-up was made for. Null only for
   *  legacy submissions stored before the column existed. */
  eventDate: string | null;
  name: string;
  pax: number;
  igHandle: string;
  igPlatform: 'instagram' | 'tiktok';
  notes: string;
}

// Strings inside a Venue's JSONB (timeslots, vipTypes) still need
// stable identifiers — they don't go to a SERIAL column, they're
// keys within the JSON document. We mint short prefixed IDs here so
// React keys stay stable across re-renders.
let _localCounter = 1_000;
const mintLocalId = (prefix: 'ts' | 'vip'): string =>
  `${prefix}${_localCounter++}`;

interface AppState {
  // data
  venues: Venue[];
  events: PromEvent[];
  guests: Guest[];
  reservations: Reservation[];
  nightRecords: NightRecord[];

  // ui meta
  hydrated: boolean;
  onboarded: boolean;
  syncing: boolean;
  syncError: string | null;

  // lifecycle
  load: () => Promise<void>;
  /** Re-fetch the whole dataset silently (no spinner). Used by
   *  visible pages to poll for new sign-ups landing via the public
   *  form. Errors are swallowed — a transient network blip shouldn't
   *  clear the local cache. */
  refresh: () => Promise<void>;
  setOnboarded: (v: boolean) => Promise<void>;

  /** Local-only ID for sub-rows inside a venue (timeslots / vip / invite types). */
  nextId: (kind: 'ts' | 'vip') => string;

  // venues
  upsertVenue: (v: Venue | Omit<Venue, 'id'>) => Promise<Venue>;
  removeVenue: (id: number) => Promise<void>;

  // events
  upsertEvent: (e: PromEvent | Omit<PromEvent, 'id'>) => Promise<PromEvent>;
  removeEvent: (id: number) => Promise<void>;
  togglePrivateInvite: (eventId: number, guestName: string) => Promise<void>;

  // guests
  upsertGuest: (g: Guest | Omit<Guest, 'id'>) => Promise<Guest>;
  removeGuest: (id: number) => Promise<void>;
  toggleArrived: (id: number) => Promise<void>;
  toggleCancelled: (id: number) => Promise<void>;

  // reservations
  upsertReservation: (r: Reservation | Omit<Reservation, 'id'>) => Promise<Reservation>;
  removeReservation: (id: number) => Promise<void>;

  // public-form sync
  importSubmissionsAsGuests: (eventId: number, submissions: PublicSubmission[]) => Promise<number>;

  // night records
  /** True if at least one NightRecord exists for the given date. */
  hasClosedNight: (isoDate: string) => boolean;
  /** Latest (by closedAt) NightRecord for the date, or null. */
  latestClosedNight: (isoDate: string) => NightRecord | null;
  /** Compute the would-be summary for today (preview before closing). */
  buildTodaySummary: (isoDate: string) => {
    summary: ReturnType<typeof buildNightSummary>;
    guests: Guest[];
    reservations: Reservation[];
    events: PromEvent[];
  };
  /** Freeze tonight: build the snapshot + summary, POST to backend,
   *  push the returned record into the local cache. Marks as a
   *  correction automatically if a record for this date exists. */
  closeNight: (isoDate: string) => Promise<NightRecord>;
  /** Pull a date range (or all) from the backend. */
  loadNightRecords: (opts?: { from?: string; to?: string }) => Promise<NightRecord[]>;
}

/**
 * Generic predicate: does this object already carry a server-assigned
 * numeric id? Stays generic so it accepts both `T` and `Omit<T, 'id'>`
 * — the call site branches on the result to send a PATCH vs POST.
 */
function hasServerId<T>(x: T): x is T & { id: number } {
  const id = (x as unknown as { id?: unknown })?.id;
  return typeof id === 'number' && Number.isFinite(id);
}

// Helper: read the legacy local snapshot (if any) so we can migrate it.
async function readLegacySnapshot(): Promise<AppDataSnapshot | null> {
  const snap = await storage.get<AppDataSnapshot>(STORAGE_KEYS.state);
  if (!snap) return null;
  // Migrate fields that older versions may be missing — same logic
  // we used when the store was Preferences-backed.
  return {
    ...snap,
    events: (snap.events ?? []).map((e) => ({
      ...e,
      isOneTime: e.isOneTime ?? false,
      eventDate: e.eventDate ?? null,
      capacity: e.capacity ?? null,
      seasonStart: e.seasonStart ?? null,
      seasonEnd: e.seasonEnd ?? null,
      shareToken: e.shareToken ?? null,
      weekdays: e.weekdays ?? (e.weekday ? [e.weekday] : []),
      invitedGuests: e.invitedGuests ?? [],
    })),
    guests: snap.guests ?? [],
    reservations: snap.reservations ?? [],
    venues: snap.venues ?? [],
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  venues: [],
  events: [],
  guests: [],
  reservations: [],
  nightRecords: [],
  hydrated: false,
  onboarded: false,
  syncing: false,
  syncError: null,

  load: async () => {
    set({ syncing: true, syncError: null });
    try {
      // Onboarded flag stays local — it's a UI preference, not data.
      const onboarded = (await storage.get<boolean>(STORAGE_KEYS.onboarded)) ?? false;

      // One-time legacy migration: if we still have an old snapshot in
      // Preferences and have NOT marked it migrated, push it up.
      const migrated = (await storage.get<boolean>(MIGRATION_FLAG_KEY)) ?? false;
      if (!migrated) {
        const legacy = await readLegacySnapshot();
        if (legacy && (legacy.venues.length || legacy.events.length || legacy.guests.length || legacy.reservations.length)) {
          try {
            await api.syncSnapshot(legacy);
            console.info('[store] migrated local snapshot to backend');
          } catch (err) {
            console.warn('[store] snapshot migration failed; will keep local snapshot for next try:', err);
            // Don't drop the local snapshot if migration failed.
            set({ syncing: false, syncError: (err as Error).message, hydrated: true, onboarded });
            return;
          }
        }
        await storage.set(MIGRATION_FLAG_KEY, true);
        // Old key is no longer authoritative — keep it as a one-shot
        // backup until we're confident, then remove.
        await storage.remove(STORAGE_KEYS.state);
      }

      const all = await api.listAll();
      // Night records are fetched separately because they're a
      // different table and the existing listAll() shape doesn't
      // include them. We don't fail the whole load if this errors.
      let nightRecords: NightRecord[] = [];
      try {
        nightRecords = await api.listNightRecords();
      } catch (err) {
        console.warn('[store] failed to load night records:', err);
      }
      set({ ...all, nightRecords, hydrated: true, onboarded, syncing: false });
    } catch (err) {
      set({
        hydrated: true,
        syncing: false,
        syncError: (err as Error).message,
      });
    }
  },

  setOnboarded: async (v) => {
    set({ onboarded: v });
    await storage.set(STORAGE_KEYS.onboarded, v);
  },

  refresh: async () => {
    try {
      const fresh = await api.listAll();
      // CRITICAL: only replace each slice if its content actually
      // changed. `api.listAll()` always returns freshly-mapped arrays,
      // so a naive `set({ ...fresh })` mints new array references on
      // every poll — which re-fires useEffect hooks that subscribe to
      // these slices (form-init effects in particular). That wiped
      // mid-typing form state. Comparing serialised payloads is small
      // enough at this scale and keeps refs stable when nothing moved.
      set((state) => {
        const out: Partial<typeof state> = {};
        if (JSON.stringify(state.venues) !== JSON.stringify(fresh.venues)) {
          out.venues = fresh.venues;
        }
        if (JSON.stringify(state.events) !== JSON.stringify(fresh.events)) {
          out.events = fresh.events;
        }
        if (JSON.stringify(state.guests) !== JSON.stringify(fresh.guests)) {
          out.guests = fresh.guests;
        }
        if (JSON.stringify(state.reservations) !== JSON.stringify(fresh.reservations)) {
          out.reservations = fresh.reservations;
        }
        return out;
      });
    } catch {
      // Stay quiet — the user is mid-task. Errors during background
      // polls shouldn't disrupt the UI.
    }
  },

  nextId: (kind) => mintLocalId(kind),

  // ── Venues ──────────────────────────────────────────────
  upsertVenue: async (v) => {
    const row = hasServerId(v)
      ? await api.updateVenue(v.id, v)
      : await api.createVenue(v);
    set((s) => {
      const idx = s.venues.findIndex((x) => x.id === row.id);
      const venues = idx >= 0
        ? s.venues.map((x) => x.id === row.id ? row : x)
        : [...s.venues, row];
      return { venues };
    });
    return row;
  },

  removeVenue: async (id) => {
    await api.deleteVenue(id);
    // Server cascade dropped events/guests/reservations attached to
    // future occurrences; refetch the lot so the cache stays honest.
    const all = await api.listAll();
    set({ ...all });
  },

  // ── Events ──────────────────────────────────────────────
  upsertEvent: async (e) => {
    const row = hasServerId(e)
      ? await api.updateEvent(e.id, e)
      : await api.createEvent(e);
    set((s) => {
      const idx = s.events.findIndex((x) => x.id === row.id);
      const events = idx >= 0
        ? s.events.map((x) => x.id === row.id ? row : x)
        : [...s.events, row];
      return { events };
    });
    return row;
  },

  removeEvent: async (id) => {
    await api.deleteEvent(id);
    const all = await api.listAll();   // refetch — guests cascaded
    set({ ...all });
  },

  togglePrivateInvite: async (eventId, guestName) => {
    const ev = get().events.find((e) => e.id === eventId);
    if (!ev) return;
    const arr = ev.invitedGuests || [];
    const i = arr.indexOf(guestName);
    const invitedGuests = i >= 0
      ? arr.filter((_, idx) => idx !== i)
      : [...arr, guestName];
    const row = await api.updateEvent(eventId, { invitedGuests });
    set((s) => ({
      events: s.events.map((x) => x.id === eventId ? row : x),
    }));
  },

  // ── Guests ──────────────────────────────────────────────
  upsertGuest: async (g) => {
    const row = hasServerId(g)
      ? await api.updateGuest(g.id, g)
      : await api.createGuest(g);
    set((s) => {
      const idx = s.guests.findIndex((x) => x.id === row.id);
      const guests = idx >= 0
        ? s.guests.map((x) => x.id === row.id ? row : x)
        : [...s.guests, row];
      return { guests };
    });
    return row;
  },

  removeGuest: async (id) => {
    await api.deleteGuest(id);
    set((s) => ({ guests: s.guests.filter((x) => x.id !== id) }));
  },

  toggleArrived: async (id) => {
    const g = get().guests.find((x) => x.id === id);
    if (!g) return;
    const row = await api.updateGuest(id, {
      checked: !g.checked,
      cancelled: false,
    });
    set((s) => ({ guests: s.guests.map((x) => x.id === id ? row : x) }));
  },

  toggleCancelled: async (id) => {
    const g = get().guests.find((x) => x.id === id);
    if (!g) return;
    const row = await api.updateGuest(id, {
      cancelled: !g.cancelled,
      checked: false,
    });
    set((s) => ({ guests: s.guests.map((x) => x.id === id ? row : x) }));
  },

  // ── Reservations ────────────────────────────────────────
  upsertReservation: async (r) => {
    const row = hasServerId(r)
      ? await api.updateReservation(r.id, r)
      : await api.createReservation(r);
    set((s) => {
      const idx = s.reservations.findIndex((x) => x.id === row.id);
      const reservations = idx >= 0
        ? s.reservations.map((x) => x.id === row.id ? row : x)
        : [...s.reservations, row];
      return { reservations };
    });
    return row;
  },

  removeReservation: async (id) => {
    await api.deleteReservation(id);
    set((s) => ({ reservations: s.reservations.filter((x) => x.id !== id) }));
  },

  // ── Public form import (unchanged contract) ─────────────
  importSubmissionsAsGuests: async (eventId, submissions) => {
    const event = get().events.find((e) => e.id === eventId);
    if (!event) return 0;
    const known = new Set(
      get().guests.filter((g) => g.submissionId).map((g) => g.submissionId as string),
    );
    const fresh = submissions.filter((s) => !known.has(s.id));
    if (!fresh.length) return 0;

    let imported = 0;
    for (const sub of fresh) {
      try {
        // Pin the imported guest to the same occurrence the public
        // sign-up was made for. Falls back to the event's own date
        // for one-time events, or null for very old legacy rows.
        const guestEventDate =
          sub.eventDate ?? (event.isOneTime ? event.eventDate : null);
        await get().upsertGuest({
          name: sub.name,
          venueId: event.venueId ?? 0,
          eventId,
          // Public submissions don't (yet) ask which timeslot the
          // guest will attend — the promoter can edit the imported
          // guest to pick the slots if it matters.
          timeslotIds: [],
          timeslotNames: [],
          pax: sub.pax,
          clubEventId: null,
          checked: false,
          cancelled: false,
          influencer: false,
          igHandle: sub.igHandle,
          igPlatform: sub.igPlatform,
          createdMonth: new Date().getMonth(),
          createdAt: new Date().toISOString().slice(0, 10),
          eventDate: guestEventDate,
          submissionId: sub.id,
          notes: sub.notes || undefined,
        });
        imported++;
      } catch (err) {
        console.warn('[store] failed to import submission', sub.id, err);
      }
    }
    return imported;
  },

  // ── Night records ───────────────────────────────────────
  hasClosedNight: (isoDate) => {
    return get().nightRecords.some((r) => r.date === isoDate);
  },

  latestClosedNight: (isoDate) => {
    const matches = get().nightRecords.filter((r) => r.date === isoDate);
    if (!matches.length) return null;
    // Sort by closedAt desc, return first (the latest correction).
    return matches.slice().sort((a, b) =>
      a.closedAt < b.closedAt ? 1 : -1,
    )[0];
  },

  buildTodaySummary: (isoDate) => {
    const { guests, reservations, events, venues } = get();
    const nightGuests = guestsForNight(guests, events, isoDate);
    const nightReservations = reservationsForNight(reservations, isoDate);
    const nightEvents = eventsForNight(events, isoDate);
    const summary = buildNightSummary(nightGuests, nightReservations, venues);
    return {
      summary,
      guests: nightGuests,
      reservations: nightReservations,
      events: nightEvents,
    };
  },

  closeNight: async (isoDate) => {
    const { guests, reservations, events, venues } = get();
    const nightGuests = guestsForNight(guests, events, isoDate);
    const nightReservations = reservationsForNight(reservations, isoDate);
    const nightEvents = eventsForNight(events, isoDate);
    const summary = buildNightSummary(nightGuests, nightReservations, venues);
    // Server auto-flags as correction when another record for the
    // date exists, so we don't have to pre-check here. The local
    // detection is just for the confirmation copy in the UI.
    const isCorrection = get().hasClosedNight(isoDate);
    const created = await api.createNightRecord({
      date: isoDate,
      isCorrection,
      guestsSnapshot: nightGuests,
      reservationsSnapshot: nightReservations,
      eventsSnapshot: nightEvents,
      venuesSnapshot: venues,
      summary,
    });
    set((s) => ({ nightRecords: [...s.nightRecords, created] }));
    return created;
  },

  loadNightRecords: async (opts) => {
    const rows = await api.listNightRecords(opts);
    set({ nightRecords: rows });
    return rows;
  },
}));
