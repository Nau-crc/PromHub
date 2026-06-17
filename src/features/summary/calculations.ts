// ─────────────────────────────────────────────────────────────
//  CRITICAL: All formulas in this file are byte-for-byte ports
//  of the original PromHub MVP (promhub_v4.html). DO NOT change
//  rounding, division order, or branching logic.
// ─────────────────────────────────────────────────────────────

import type { Reservation, Venue, Guest, PromEvent } from '@/core/types';
import { round2 } from '@/core/utils/format';

// ── Lookup helpers ──────────────────────────────────────────
export const venueName = (id: number, venues: Venue[]): string => {
  const v = venues.find((x) => x.id === id);
  return v ? v.name : '—';
};
export const venueById = (id: number, venues: Venue[]): Venue | undefined =>
  venues.find((x) => x.id === id);

export const venueGuestCount = (id: number, guests: Guest[]): number =>
  guests.filter((g) => g.venueId === id).reduce((a, g) => a + g.pax, 0);

// ── VIP table capacity ──────────────────────────────────────
// Each vipType has tableCapacity; each reservation uses one
export function venueVipSlotsUsed(
  venueId: number,
  vipTypeName: string,
  reservations: Reservation[],
): number {
  return reservations.filter((r) => r.venueId === venueId && r.vipType === vipTypeName).length;
}

export function venueVipSlotsLeft(
  venueId: number,
  vipTypeName: string,
  venues: Venue[],
  reservations: Reservation[],
): number {
  const v = venueById(venueId, venues);
  if (!v) return 0;
  const t = (v.vipTypes || []).find((x) => x.name === vipTypeName);
  if (!t) return 0;
  return Math.max(0, (t.tableCapacity || 0) - venueVipSlotsUsed(venueId, vipTypeName, reservations));
}

// ── VIP price lookup ────────────────────────────────────────
//
// Prices moved from venue → event in the 0008 refactor. The lookup
// now consults the EVENT'S `vipPrices` map (keyed by VIP type name)
// when an `eventId` is available. Falls back to the legacy
// `Venue.vipTypes[x].price` field for pre-refactor rows.
export const getVipPrice = (
  vid: number,
  name: string,
  venues: Venue[],
  events: PromEvent[] = [],
  eventId?: number | null,
): number => {
  if (eventId != null) {
    const ev = events.find((e) => e.id === eventId);
    const fromEvent = ev?.vipPrices?.[name];
    if (typeof fromEvent === 'number') return fromEvent;
  }
  const v = venueById(vid, venues);
  if (!v) return 0;
  const t = (v.vipTypes || []).find((x) => x.name === name);
  return t?.price ?? 0;
};

// ── Commission breakdown — the core money formula ───────────
// Original (promhub_v4.html, line ~387):
//   const price = getVipPrice(r.venueId, r.vipType);            // price per table
//   const promoter = Math.round(price * (r.commissionPct||0)/100*100)/100;
//   const woman    = r.fromInvite
//                  ? Math.round(promoter * (r.womanPct||0)/100*100)/100
//                  : 0;
//   return { price, tableTotal: price, promoter, woman };
export interface CommissionResult {
  price: number;
  tableTotal: number;
  promoter: number;
  woman: number;
}

export function commCalc(
  r: Reservation,
  venues: Venue[],
  events: PromEvent[] = [],
): CommissionResult {
  const price = getVipPrice(r.venueId, r.vipType, venues, events, r.eventId);
  const promoter = round2(price * (r.commissionPct || 0) / 100);
  const woman = r.fromInvite ? round2(promoter * (r.womanPct || 0) / 100) : 0;
  return { price, tableTotal: price, promoter, woman };
}

// "Net to you" — appears verbatim in the UI as
//   Math.round((promoter - woman) * 100) / 100
export const netToYou = (c: CommissionResult): number => round2(c.promoter - c.woman);

// ── Slot helpers ────────────────────────────────────────────
// Slots moved from venue → event in 0008. The lookups now scan
// `events[].timeslots`. The signature still ACCEPTS `Venue[]` for
// callers that haven't migrated, but the venue path returns null
// — they pass `events` going forward.
export function slotById(id: string, events: PromEvent[]) {
  for (const e of events) {
    const s = (e.timeslots || []).find((t) => t.id === id);
    if (s) return s;
  }
  return null;
}

export function slotLabel(id: string, events: PromEvent[]): string {
  const s = slotById(id, events);
  return s ? `${s.name} (${s.startTime}–${s.endTime})` : '—';
}

// VIP options filtered by pax — matches original `getVipOptionsForPax`
export function getVipOptionsForPax(venueId: number, pax: number, venues: Venue[]) {
  const v = venueById(venueId, venues);
  if (!v) return [];
  return (v.vipTypes || []).filter((t) => {
    const min = t.minPax || 1;
    const max = t.maxPax || 999;
    return !pax || (pax >= min && pax <= max);
  });
}

// ── Late club events filter ─────────────────────────────────
export const lateClubEvents = (events: PromEvent[]): PromEvent[] =>
  events.filter((e) => e.isLateClub);

// ── Guest ↔ event attribution helper ────────────────────────
//
// A guest can carry TWO event links:
//   - `eventId`     → the main event (dinner / show / etc.)
//   - `clubEventId` → an optional late-club follow-on
//
// Both listings — the main event's and the club event's — must
// show the same guest with the same pax. This helper is the single
// source of truth so every filter site stays consistent.
export const isGuestOnEvent = (
  g: Pick<Guest, 'eventId' | 'clubEventId'>,
  eventId: number,
): boolean => g.eventId === eventId || g.clubEventId === eventId;

// ── Per-attendance helpers ─────────────────────────────────
//
// A guest's main-event link and her late-club link are tracked
// independently — she may cancel one without cancelling the other.
// These helpers return the right `cancelled` / `checked` flag for a
// given attendance, so capacity / arrival counts stay consistent.

/** Is this guest LINKED to `eventId` via her main attendance? */
export const isMainAttendance = (
  g: Pick<Guest, 'eventId'>,
  eventId: number,
): boolean => g.eventId === eventId;

/** Is this guest LINKED to `eventId` via her late-club attendance? */
export const isClubAttendance = (
  g: Pick<Guest, 'eventId' | 'clubEventId'>,
  eventId: number,
): boolean => g.clubEventId === eventId && g.eventId !== eventId;

/** Has the guest cancelled her attendance at THIS event specifically? */
export const isCancelledFor = (
  g: Pick<Guest, 'eventId' | 'clubEventId' | 'cancelled' | 'cancelledClub'>,
  eventId: number,
): boolean => {
  if (isClubAttendance(g, eventId)) return !!g.cancelledClub;
  if (isMainAttendance(g, eventId)) return !!g.cancelled;
  return false;
};

/** Has the guest arrived/checked-in for THIS event specifically? */
export const isCheckedFor = (
  g: Pick<Guest, 'eventId' | 'clubEventId' | 'checked' | 'checkedClub'>,
  eventId: number,
): boolean => {
  if (isClubAttendance(g, eventId)) return !!g.checkedClub;
  if (isMainAttendance(g, eventId)) return !!g.checked;
  return false;
};

/** Is this guest ATTENDING the event — i.e. linked to it, NOT
 *  cancelled for that attendance, AND NOT waitlisted? Waitlisted
 *  guests are pending acceptance — they don't count toward used
 *  capacity nor appear in the confirmed list. */
export const isGuestAttendingEvent = (
  g: Pick<Guest, 'eventId' | 'clubEventId' | 'cancelled' | 'cancelledClub' | 'waitlisted'>,
  eventId: number,
): boolean =>
  isGuestOnEvent(g, eventId)
  && !isCancelledFor(g, eventId)
  && !g.waitlisted;

// ── Waitlist helpers ───────────────────────────────────────
//
// Position in the queue is computed at READ time from the guest
// list, ordered by createdAt. That way promoting from the middle
// (toggling `waitlisted = false`) doesn't require re-numbering
// anything — positions just shift down by themselves.

/** All waitlisted guests for this event, ordered by createdAt. */
export function waitlistFor(
  guests: Guest[],
  eventId: number,
  isoDate?: string,
): Guest[] {
  return guests
    .filter((g) =>
      g.waitlisted
      && isGuestOnEvent(g, eventId)
      && !isCancelledFor(g, eventId)
      && (!isoDate || !g.eventDate || g.eventDate === isoDate))
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1
      : a.createdAt > b.createdAt ? 1
      : a.id - b.id));
}

/** The 1-based queue position of a guest in the waitlist, or null
 *  if she's not waitlisted (or not on this event). */
export function waitlistPosition(
  guests: Guest[],
  guestId: number,
  eventId: number,
  isoDate?: string,
): number | null {
  const list = waitlistFor(guests, eventId, isoDate);
  const idx = list.findIndex((g) => g.id === guestId);
  return idx < 0 ? null : idx + 1;
}

// ── Fixed-fee logic ────────────────────────────────────────
//
// Each event optionally declares a `minGuestsThreshold` and a
// `fixedFee`. On any occurrence where the promoter's confirmed
// pax for the event ≥ threshold, she earns the fee for THAT night.
//
// Both fields are nullable independently of each other, but the
// fee only kicks in when BOTH are set — the helper handles that.

/** Pax (attending, not cancelled) confirmed for `event` on `isoDate`. */
export function paxForEventOnDate(
  event: PromEvent,
  guests: Guest[],
  isoDate: string,
): number {
  return guests
    .filter((g) => isGuestAttendingEvent(g, event.id)
      && (!g.eventDate || g.eventDate === isoDate))
    .reduce((a, g) => a + g.pax, 0);
}

export interface FixedFeeStatus {
  /** € value the event would pay this occurrence — 0 if not earned
   *  or no fee logic configured. */
  amount: number;
  /** Threshold the event sets, or null if no fee logic. */
  threshold: number | null;
  /** Pax confirmed for this occurrence. */
  pax: number;
  /** True when fee logic is configured AND pax >= threshold. */
  earned: boolean;
}

/** Compute the fixed-fee outcome for an event on a specific date. */
export function fixedFeeStatus(
  event: PromEvent,
  guests: Guest[],
  isoDate: string,
): FixedFeeStatus {
  const threshold = event.minGuestsThreshold;
  const fee = event.fixedFee;
  const pax = paxForEventOnDate(event, guests, isoDate);
  if (threshold == null || fee == null || fee <= 0) {
    return { amount: 0, threshold, pax, earned: false };
  }
  const earned = pax >= threshold;
  return { amount: earned ? round2(fee) : 0, threshold, pax, earned };
}

/** Total fixed fees the promoter earned on a date across all events. */
export function totalFixedFeesForDate(
  events: PromEvent[],
  guests: Guest[],
  isoDate: string,
): number {
  let sum = 0;
  for (const e of events) {
    sum += fixedFeeStatus(e, guests, isoDate).amount;
  }
  return round2(sum);
}

// ── Per-slot capacity helpers ───────────────────────────────
//
// Slot capacities are the granular truth — show the promoter what
// each slot can hold AND what's confirmed so far for tonight.

export interface SlotCapacity {
  slotId: string;
  slotName: string;
  startTime: string;
  endTime: string;
  capacity: number;          // 0 = unlimited
  used: number;              // pax confirmed in this slot for the date
  left: number;              // remaining; Infinity if unlimited
  pct: number;
  fillClass: '' | 'warn' | 'full';
}

/** Per-slot capacity breakdown for an event on a specific date. */
export function slotCapacities(
  event: PromEvent,
  guests: Guest[],
  isoDate: string,
): SlotCapacity[] {
  return (event.timeslots ?? []).map((slot) => {
    const used = guests
      .filter((g) =>
        isGuestOnEvent(g, event.id)
        && !isCancelledFor(g, event.id)
        && !g.waitlisted
        && (!g.eventDate || g.eventDate === isoDate)
        && (g.timeslotIds ?? []).includes(slot.id))
      .reduce((a, g) => a + g.pax, 0);
    const capacity = slot.guestCapacity || 0;
    if (!capacity) {
      return {
        slotId: slot.id, slotName: slot.name,
        startTime: slot.startTime, endTime: slot.endTime,
        capacity: 0, used, left: Infinity, pct: 0, fillClass: '',
      };
    }
    const left = Math.max(0, capacity - used);
    const pct = Math.min(100, Math.round((used / capacity) * 100));
    const fillClass: '' | 'warn' | 'full' =
      pct >= 100 ? 'full' : pct >= 75 ? 'warn' : '';
    return {
      slotId: slot.id, slotName: slot.name,
      startTime: slot.startTime, endTime: slot.endTime,
      capacity, used, left, pct, fillClass,
    };
  });
}

// ── Occurrence helpers ─────────────────────────────────────
//
// An event "occurs on" a given ISO date when:
//  - One-time event: `event.eventDate === isoDate`
//  - Recurring event: today's weekday is in `event.weekdays`
//                     AND date is within [seasonStart, seasonEnd]
//                     (each bound is optional → open-ended).
//
// Used by HomePage to show only today's events, and by event
// detail to enumerate the dates a recurring event runs on.

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export function occurs(event: PromEvent, isoDate: string): boolean {
  if (event.isOneTime) return event.eventDate === isoDate;
  // Parse local date — `new Date('2026-05-15')` parses as UTC, which can shift
  // the weekday by 1 across timezones. Build via Y/M/D constructor instead.
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return false;
  const local = new Date(y, m - 1, d);
  const wd = WEEKDAY_NAMES[local.getDay()];
  if (!event.weekdays?.includes(wd)) return false;
  if (event.seasonStart && isoDate < event.seasonStart) return false;
  if (event.seasonEnd && isoDate > event.seasonEnd) return false;
  return true;
}

/** First occurrence of `event` on or after `fromIsoDate`. Returns null if none. */
export function nextOccurrence(event: PromEvent, fromIsoDate: string): string | null {
  if (event.isOneTime) {
    if (!event.eventDate) return null;
    return event.eventDate >= fromIsoDate ? event.eventDate : null;
  }
  if (!event.weekdays?.length) return null;
  const [y, m, d] = fromIsoDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  // Look up to 366 days forward
  for (let i = 0; i < 366; i++) {
    const t = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    if (occurs(event, iso)) return iso;
  }
  return null;
}

/** Most recent occurrence on or before `untilIsoDate`. Returns null if none. */
export function previousOccurrence(event: PromEvent, untilIsoDate: string): string | null {
  if (event.isOneTime) {
    if (!event.eventDate) return null;
    return event.eventDate <= untilIsoDate ? event.eventDate : null;
  }
  if (!event.weekdays?.length) return null;
  const [y, m, d] = untilIsoDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  for (let i = 0; i < 366; i++) {
    const t = new Date(start.getFullYear(), start.getMonth(), start.getDate() - i);
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    if (occurs(event, iso)) return iso;
  }
  return null;
}

// ── Time-of-day overlap ────────────────────────────────────
// True when `time` ("HH:MM") falls inside [start, end). End <= start
// means the slot wraps past midnight (e.g. 22:00 → 02:00, or end "00:00").
export function timeInSlot(time: string, startTime: string, endTime: string): boolean {
  if (!time || !startTime || !endTime) return false;
  const wraps = endTime <= startTime;
  if (!wraps) return time >= startTime && time < endTime;
  return time >= startTime || time < endTime;
}

/**
 * Find every event scheduled at the venue on `isoDate` whose timeslot
 * window contains `time`. Used by the reservation form to surface a
 * "there's an event happening at this time" banner.
 */
export interface EventSlotMatch {
  event: PromEvent;
  slotName: string;
  startTime: string;
  endTime: string;
}
export function findEventsAt(
  venueId: number | null,
  isoDate: string,
  time: string,
  events: PromEvent[],
  // venues kept for signature stability with callers; slots are
  // now defined on the event itself so we no longer need to look
  // up the venue's timeslot list.
  _venues: Venue[],
): EventSlotMatch[] {
  if (venueId == null || !isoDate) return [];
  const out: EventSlotMatch[] = [];
  for (const e of events) {
    if (e.venueId !== venueId) continue;
    if (!occurs(e, isoDate)) continue;
    for (const slot of e.timeslots || []) {
      if (!time || timeInSlot(time, slot.startTime, slot.endTime)) {
        out.push({ event: e, slotName: slot.name, startTime: slot.startTime, endTime: slot.endTime });
      }
    }
  }
  return out;
}

/**
 * Has this event finished running entirely?
 *  - One-time: its date is strictly before today.
 *  - Recurring with seasonEnd: seasonEnd is strictly before today.
 *  - Recurring without seasonEnd: never (open-ended).
 *
 * Used for cascading deletes: when a venue is removed we keep
 * past events for historical reporting, and only drop future ones.
 */
export function isEventPast(event: PromEvent, todayIso: string): boolean {
  if (event.isOneTime) {
    return !!event.eventDate && event.eventDate < todayIso;
  }
  return !!event.seasonEnd && event.seasonEnd < todayIso;
}

/** Human-readable schedule label for an event ("Sat/Sun · until Sep 30", "Jul 15", "Recurring"). */
export function eventScheduleLabel(event: PromEvent): string {
  if (event.isOneTime) {
    if (!event.eventDate) return 'One-time (no date)';
    return new Date(event.eventDate + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }
  const dayList = (event.weekdays || []).map((d) => d.slice(0, 3)).join('/');
  const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
  const parts: string[] = [];
  if (dayList) parts.push(dayList);
  if (event.seasonStart && event.seasonEnd) {
    parts.push(`${fmt(event.seasonStart)} – ${fmt(event.seasonEnd)}`);
  } else if (event.seasonEnd) {
    parts.push(`until ${fmt(event.seasonEnd)}`);
  } else if (event.seasonStart) {
    parts.push(`from ${fmt(event.seasonStart)}`);
  }
  return parts.join(' · ') || 'Recurring';
}

// ── Event capacity helpers ─────────────────────────────────
export interface EventCapacity {
  used: number;       // pax already invited
  capacity: number;   // declared capacity, 0 = unlimited
  left: number;       // remaining slots; Infinity if unlimited
  pct: number;        // 0..100, 0 if unlimited
  fillClass: '' | 'warn' | 'full';
}

/**
 * Capacity for a specific occurrence of the event.
 *
 * Capacity = SUM of `event.timeslots[].guestCapacity`. Slot caps
 * are the granular truth, summed per night. Cancelled + waitlisted
 * guests are excluded from `used`. Pax counter is per-OCCURRENCE
 * when `isoDate` is provided — that's how the night resets.
 */
export function eventCapacity(
  eventId: number,
  guests: Guest[],
  events: PromEvent[],
  isoDate: string | null = null,
): EventCapacity {
  const e = events.find((x) => x.id === eventId);
  const used = guests
    .filter((g) => isGuestOnEvent(g, eventId)
      && !isCancelledFor(g, eventId)
      && !g.waitlisted
      && (isoDate == null || g.eventDate === isoDate))
    .reduce((a, g) => a + g.pax, 0);
  const capacity = (e?.timeslots ?? []).reduce(
    (a, s) => a + (s.guestCapacity || 0),
    0,
  );
  if (!capacity) {
    return { used, capacity: 0, left: Infinity, pct: 0, fillClass: '' };
  }
  const left = Math.max(0, capacity - used);
  const pct = Math.min(100, Math.round((used / capacity) * 100));
  const fillClass = pct >= 100 ? 'full' : pct >= 75 ? 'warn' : '';
  return { used, capacity, left, pct, fillClass };
}

// ── Aggregations used by Summary panels ─────────────────────

// Today: totals across all reservations
export interface TodayTotals {
  totP: number;        // total promoter commissions from reservations (€)
  totW: number;        // total to inviters (€)
  totFixedFees: number; // sum of fixed fees earned across events tonight (€)
  net: number;         // totP + totFixedFees - totW (€)
  influencerCount: number;
  guestsByTimeslot: Record<string, number>; // timeslot name → pax count
  /** Per-event fixed fee detail: event id → {name, earned, amount}. */
  fixedFeesByEvent: Array<{
    eventId: number;
    eventName: string;
    pax: number;
    threshold: number;
    amount: number;
    earned: boolean;
  }>;
}

export function summarizeToday(
  guests: Guest[],
  reservations: Reservation[],
  venues: Venue[],
  // New optional inputs so the fixed-fee logic can run. Optional
  // so legacy callers that only need commission totals still work.
  events: PromEvent[] = [],
  isoDate?: string,
): TodayTotals {
  let totP = 0;
  let totW = 0;
  for (const r of reservations) {
    const { promoter, woman } = commCalc(r, venues, events);
    totP += promoter;
    totW += woman;
  }

  // Bucket guest pax by timeslot name.
  const byTimeslot: Record<string, number> = {};
  guests.forEach((g) => {
    (g.timeslotNames || []).forEach((t) => {
      byTimeslot[t] = (byTimeslot[t] || 0) + g.pax;
    });
  });

  // ── Fixed fees per event ──────────────────────────────
  // We need a date to evaluate per-occurrence pax. Without one,
  // we can still surface the event configs but report 0 earned.
  const fixedFeesByEvent: TodayTotals['fixedFeesByEvent'] = [];
  let totFixedFees = 0;
  if (isoDate) {
    for (const ev of events) {
      if (ev.minGuestsThreshold == null || ev.fixedFee == null || ev.fixedFee <= 0) continue;
      const st = fixedFeeStatus(ev, guests, isoDate);
      fixedFeesByEvent.push({
        eventId: ev.id,
        eventName: ev.name,
        pax: st.pax,
        threshold: ev.minGuestsThreshold,
        amount: st.amount,
        earned: st.earned,
      });
      totFixedFees += st.amount;
    }
  }
  totFixedFees = round2(totFixedFees);

  return {
    totP: round2(totP),
    totW: round2(totW),
    totFixedFees,
    net: round2(totP + totFixedFees - totW),
    influencerCount: guests.filter((g) => g.influencer).length,
    guestsByTimeslot: byTimeslot,
    fixedFeesByEvent,
  };
}

// Yearly: month counts (calendar months 0..11) — counts guests created per month
export function summarizeYearlyGuestsByMonth(guests: Guest[]): number[] {
  const mc = new Array(12).fill(0);
  guests.forEach((g) => {
    if (g.createdMonth != null) mc[g.createdMonth]++;
  });
  return mc;
}

// Yearly: month counts of reservations by createdAt month
export function summarizeYearlyReservationsByMonth(reservations: Reservation[]): number[] {
  const mc = new Array(12).fill(0);
  reservations.forEach((r) => {
    if (!r.createdAt) return;
    const m = parseInt(r.createdAt.slice(5, 7), 10) - 1;
    if (!Number.isNaN(m) && m >= 0 && m < 12) mc[m]++;
  });
  return mc;
}

// ── Daily / Monthly aggregations ───────────────────────────
export interface DayDigest {
  guests: Guest[];
  reservations: Reservation[];
  totP: number;
  totW: number;
  net: number;
}
export function digestForDay(
  isoKey: string,
  guests: Guest[],
  reservations: Reservation[],
  venues: Venue[],
): DayDigest {
  const dayGuests = guests.filter((g) => g.createdAt === isoKey);
  const dayRes = reservations.filter((r) => r.createdAt === isoKey);
  let totP = 0;
  let totW = 0;
  for (const r of dayRes) {
    const { promoter, woman } = commCalc(r, venues);
    totP += promoter;
    totW += woman;
  }
  return {
    guests: dayGuests,
    reservations: dayRes,
    totP: round2(totP),
    totW: round2(totW),
    net: round2(totP - totW),
  };
}

// All ISO dates of a calendar month (year, monthIndex 0..11)
export interface MonthDigest {
  totP: number;
  totW: number;
  net: number;
  guestPax: number;
  reservations: Reservation[];
  vipTablesByType: Record<string, number>;  // "Venue · VIP type" → count
}
export function digestForMonth(
  year: number,
  month: number,
  guests: Guest[],
  reservations: Reservation[],
  venues: Venue[],
): MonthDigest {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const monthRes = reservations.filter((r) => r.createdAt?.startsWith(prefix));
  const monthGuests = guests.filter((g) => g.createdAt?.startsWith(prefix));
  let totP = 0, totW = 0;
  const vipTablesByType: Record<string, number> = {};
  for (const r of monthRes) {
    const { promoter, woman } = commCalc(r, venues);
    totP += promoter;
    totW += woman;
    const key = `${venueName(r.venueId, venues)} · ${r.vipType || '—'}`;
    vipTablesByType[key] = (vipTablesByType[key] || 0) + 1;
  }
  return {
    totP: round2(totP),
    totW: round2(totW),
    net: round2(totP - totW),
    guestPax: monthGuests.reduce((a, g) => a + g.pax, 0),
    reservations: monthRes,
    vipTablesByType,
  };
}

// Influencers: sorted unique by visit count
export interface InfluencerRow {
  guest: Guest;
  visits: number;
}

export function summarizeInfluencers(guests: Guest[]): InfluencerRow[] {
  const infs = guests.filter((g) => g.influencer);
  const vm: Record<string, number> = {};
  infs.forEach((g) => { vm[g.name] = (vm[g.name] || 0) + 1; });
  const unique = [...new Map(infs.map((g) => [g.name, g])).values()].sort(
    (a, b) => (vm[b.name] || 0) - (vm[a.name] || 0),
  );
  return unique.map((g) => ({ guest: g, visits: vm[g.name] || 1 }));
}

// VIP capacity matrix per venue — used by Today panel
export interface VipCapacityRow {
  venueId: number;
  venueName: string;
  vipName: string;
  used: number;
  capacity: number;
  pct: number;
  fillClass: '' | 'warn' | 'full';
}

export function summarizeVipCapacity(
  venues: Venue[],
  reservations: Reservation[],
): VipCapacityRow[] {
  return venues.flatMap((v) =>
    (v.vipTypes || []).map((t) => {
      const used = venueVipSlotsUsed(v.id, t.name, reservations);
      const cap = t.tableCapacity || 0;
      const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
      const fillClass = pct >= 100 ? 'full' : pct >= 75 ? 'warn' : '';
      return { venueId: v.id, venueName: v.name, vipName: t.name, used, capacity: cap, pct, fillClass };
    }),
  );
}
