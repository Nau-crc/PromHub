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
