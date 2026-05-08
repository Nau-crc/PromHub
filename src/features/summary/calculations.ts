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
export const getVipPrice = (vid: number, name: string, venues: Venue[]): number => {
  const v = venueById(vid, venues);
  if (!v) return 0;
  const t = (v.vipTypes || []).find((x) => x.name === name);
  return t ? t.price : 0;
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

export function commCalc(r: Reservation, venues: Venue[]): CommissionResult {
  const price = getVipPrice(r.venueId, r.vipType, venues);
  const promoter = round2(price * (r.commissionPct || 0) / 100);
  const woman = r.fromInvite ? round2(promoter * (r.womanPct || 0) / 100) : 0;
  return { price, tableTotal: price, promoter, woman };
}

// "Net to you" — appears verbatim in the UI as
//   Math.round((promoter - woman) * 100) / 100
export const netToYou = (c: CommissionResult): number => round2(c.promoter - c.woman);

// ── Slot helpers ────────────────────────────────────────────
export function slotById(id: string, venues: Venue[]) {
  for (const v of venues) {
    const s = (v.timeslots || []).find((t) => t.id === id);
    if (s) return s;
  }
  return null;
}

export function slotLabel(id: string, venues: Venue[]): string {
  const s = slotById(id, venues);
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
 * If `isoDate` is provided, only guests on that date count toward `used`.
 * If null, all guests linked to the event count (legacy behaviour).
 */
export function eventCapacity(
  eventId: number,
  guests: Guest[],
  events: PromEvent[],
  isoDate: string | null = null,
): EventCapacity {
  const e = events.find((x) => x.id === eventId);
  // Cancelled guests free up their seats — they don't count toward the
  // used capacity, so the next swipe-cancel widens "left" again.
  const used = guests
    .filter((g) => g.eventId === eventId
      && !g.cancelled
      && (isoDate == null || g.eventDate === isoDate))
    .reduce((a, g) => a + g.pax, 0);
  const capacity = e?.capacity ?? 0;
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
  totP: number;        // total promoter earnings (€)
  totW: number;        // total to inviters (€)
  net: number;         // net to you (€)
  influencerCount: number;
  guestsByInviteType: Record<string, number>; // type name → pax count
}

export function summarizeToday(
  guests: Guest[],
  reservations: Reservation[],
  venues: Venue[],
): TodayTotals {
  let totP = 0;
  let totW = 0;
  for (const r of reservations) {
    const { promoter, woman } = commCalc(r, venues);
    totP += promoter;
    totW += woman;
  }
  const byType: Record<string, number> = {};
  guests.forEach((g) => {
    (g.inviteTypeNames || []).forEach((t) => {
      byType[t] = (byType[t] || 0) + g.pax;
    });
  });
  return {
    totP: round2(totP),
    totW: round2(totW),
    net: round2(totP - totW),
    influencerCount: guests.filter((g) => g.influencer).length,
    guestsByInviteType: byType,
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
