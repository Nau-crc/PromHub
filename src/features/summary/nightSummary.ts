import type {
  Guest, Reservation, PromEvent, Venue, NightRecordSummary,
} from '@/core/types';
import { commCalc, venueName } from './calculations';

// ─────────────────────────────────────────────────────────────
//  Pre-compute the summary that gets frozen into a NightRecord.
//
//  This is the moment-of-close calculation. Once stored, the
//  numbers must never be recomputed: VIP prices and event
//  configurations can change after the night ends, but a closed
//  night's totals stay locked in forever.
//
//  Inputs must be the lists the promoter SEES for that date —
//  caller filters by date before passing in. We don't re-filter
//  here so the function stays pure of date logic.
// ─────────────────────────────────────────────────────────────

export function buildNightSummary(
  guests: Guest[],
  reservations: Reservation[],
  venues: Venue[],
): NightRecordSummary {
  // ── Aggregate totals ─────────────────────────────────────
  // Per-attendance cancellation: a guest still counts toward the
  // night's total if she's coming to at LEAST ONE event tonight.
  // Cancellation of just the main OR just the club doesn't pull
  // her from the night's total — she's still in the venue.
  const isAttendingTonight = (g: Guest): boolean => {
    const mainOk = g.eventId != null && !g.cancelled;
    const clubOk = g.clubEventId != null && !g.cancelledClub;
    return mainOk || clubOk;
  };
  const totalGuests = guests
    .filter(isAttendingTonight)
    .reduce((sum, g) => sum + g.pax, 0);
  const totalReservations = reservations.length;

  let grossCommission = 0;
  let paidToInviters = 0;
  for (const r of reservations) {
    const c = commCalc(r, venues);
    grossCommission += c.promoter;
    paidToInviters += c.woman;
  }
  // Round to 2 decimals so the snapshot doesn't carry float dust.
  grossCommission = round2(grossCommission);
  paidToInviters = round2(paidToInviters);
  const netCommission = round2(grossCommission - paidToInviters);

  const influencerCount = guests
    .filter((g) => g.influencer && isAttendingTonight(g)).length;

  // ── Per-dimension breakdowns ─────────────────────────────
  const byInviteType: Record<string, number> = {};
  for (const g of guests) {
    if (!isAttendingTonight(g)) continue;
    for (const slotName of g.timeslotNames || []) {
      byInviteType[slotName] = (byInviteType[slotName] ?? 0) + g.pax;
    }
  }

  const byVenue: Record<string, { guests: number; tables: number }> = {};
  for (const g of guests) {
    if (!isAttendingTonight(g)) continue;
    const name = venueName(g.venueId, venues);
    byVenue[name] ??= { guests: 0, tables: 0 };
    byVenue[name].guests += g.pax;
  }
  for (const r of reservations) {
    const name = venueName(r.venueId, venues);
    byVenue[name] ??= { guests: 0, tables: 0 };
    byVenue[name].tables += 1;
  }

  const byVipType: Record<string, { sold: number; capacity: number; revenue: number }> = {};
  // Sold + revenue from reservations
  for (const r of reservations) {
    if (!r.vipType) continue;
    byVipType[r.vipType] ??= { sold: 0, capacity: 0, revenue: 0 };
    byVipType[r.vipType].sold += 1;
    const c = commCalc(r, venues);
    byVipType[r.vipType].revenue = round2(byVipType[r.vipType].revenue + c.price);
  }
  // Capacity from the union of venue definitions referenced
  for (const v of venues) {
    for (const vt of v.vipTypes || []) {
      if (!byVipType[vt.name]) continue; // only report types with sales
      byVipType[vt.name].capacity += vt.tableCapacity || 0;
    }
  }

  return {
    totalGuests,
    totalReservations,
    grossCommission,
    paidToInviters,
    netCommission,
    influencerCount,
    byInviteType,
    byVenue,
    byVipType,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────
//  Filter helpers — the lists that go into a NightRecord
//  snapshot must be only the rows that belong to THAT calendar
//  date, so the snapshot is self-contained.
// ─────────────────────────────────────────────────────────────

/**
 * Guests that count toward this night: pinned to the date or
 * unpinned (legacy) but linked to an event that occurs today.
 */
export function guestsForNight(
  guests: Guest[],
  events: PromEvent[],
  isoDate: string,
): Guest[] {
  const todayEventIds = new Set(
    events.filter((e) => occursOn(e, isoDate)).map((e) => e.id),
  );
  return guests.filter((g) => {
    const onTodayEvent =
      (g.eventId != null && todayEventIds.has(g.eventId)) ||
      (g.clubEventId != null && todayEventIds.has(g.clubEventId));
    if (!onTodayEvent) return false;
    return !g.eventDate || g.eventDate === isoDate;
  });
}

/**
 * Reservations pinned to this date.
 */
export function reservationsForNight(
  reservations: Reservation[],
  isoDate: string,
): Reservation[] {
  return reservations.filter((r) => !r.eventDate || r.eventDate === isoDate);
}

/**
 * Events scheduled on this date.
 */
export function eventsForNight(events: PromEvent[], isoDate: string): PromEvent[] {
  return events.filter((e) => occursOn(e, isoDate));
}

// Inline copy of `occurs` from calculations.ts to avoid a circular
// import (calculations.ts imports from this module would create
// the cycle).
const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
function occursOn(event: PromEvent, isoDate: string): boolean {
  if (event.isOneTime) return event.eventDate === isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return false;
  const local = new Date(y, m - 1, d);
  const wd = WEEKDAY_NAMES[local.getDay()];
  if (!event.weekdays?.includes(wd)) return false;
  if (event.seasonStart && isoDate < event.seasonStart) return false;
  if (event.seasonEnd && isoDate > event.seasonEnd) return false;
  return true;
}
