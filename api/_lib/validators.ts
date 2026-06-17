import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
//  Zod schemas for request bodies. Each endpoint runs the body
//  through .parse() — a malformed payload throws a ZodError
//  which the error boundary turns into a 400 with a useful
//  list of issues, so the client always knows what's missing.
//
//  Convention: types here mirror the DB schema but with sensible
//  defaults / optional fields for "create" vs "update" payloads.
// ─────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected yyyy-mm-dd');
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'expected HH:MM');
const uuid = z.string().uuid();
const platform = z.enum(['instagram', 'tiktok']);

// ── Venue ──────────────────────────────────────────────────
const timeslotSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  startTime: hhmm,
  endTime: hhmm,
  guestCapacity: z.number().int().min(0),
});

const vipTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  minPax: z.number().int().min(1),
  maxPax: z.number().int().min(1),
  tableCapacity: z.number().int().min(0),
  // `price` was here pre-0008; now lives on the event in
  // `vipPrices`. Accept it loosely on input for forward-compat
  // but ignore on the way to the DB.
  price: z.number().optional(),
});

// (Legacy invite-type schema dropped — guests now select from the
//  event's selected timeslots instead of a per-venue invite-type list.)

export const venueInputSchema = z.object({
  name: z.string().min(1).max(120),
  phoneCode: z.string().nullable().optional(),
  phoneNum: z.string().nullable().optional(),
  vipTypes: z.array(vipTypeSchema).default([]),
});
export type VenueInput = z.infer<typeof venueInputSchema>;

// ── Event ──────────────────────────────────────────────────
export const eventInputSchema = z.object({
  name: z.string().min(1).max(120),
  venueId: z.number().int().nullable().optional(),
  weekdays: z.array(z.string()).default([]),
  description: z.string().max(1000).default(''),
  isPrivate: z.boolean().default(false),
  isLateClub: z.boolean().default(false),
  invitedGuests: z.array(z.string()).default([]),
  isOneTime: z.boolean().default(false),
  eventDate: isoDate.nullable().optional(),
  /** Per-event timeslot definitions — the event OWNS them now. */
  timeslots: z.array(timeslotSchema).default([]),
  /** Map of VIP-type name → price-in-€ at this event. */
  vipPrices: z.record(z.string(), z.number().min(0)).default({}),
  /** Pair: both fields must either be set together OR both null. */
  minGuestsThreshold: z.number().int().min(1).nullable().optional(),
  fixedFee: z.number().min(0).nullable().optional(),
  seasonStart: isoDate.nullable().optional(),
  seasonEnd: isoDate.nullable().optional(),
  shareToken: uuid.nullable().optional(),
});
export type EventInput = z.infer<typeof eventInputSchema>;

// ── Guest ──────────────────────────────────────────────────
export const guestInputSchema = z.object({
  name: z.string().min(1).max(120),
  eventId: z.number().int(),                    // required
  venueId: z.number().int().nullable().optional(),
  clubEventId: z.number().int().nullable().optional(),
  timeslotIds: z.array(z.string()).default([]),
  timeslotNames: z.array(z.string()).default([]),
  pax: z.number().int().min(1).max(50).default(1),
  checked: z.boolean().default(false),
  cancelled: z.boolean().default(false),
  // Per-attendance flags for the late-club link (independent of
  // the main-event flags above).
  checkedClub: z.boolean().default(false),
  cancelledClub: z.boolean().default(false),
  waitlisted: z.boolean().default(false),
  extraEventIds: z.array(z.number().int()).default([]),
  influencer: z.boolean().default(false),
  igHandle: z.string().max(60).default(''),
  igPlatform: platform.default('instagram'),
  notes: z.string().max(280).nullable().optional(),
  eventDate: isoDate.nullable().optional(),
  submissionId: z.string().nullable().optional(),
});
export type GuestInput = z.infer<typeof guestInputSchema>;

// ── Reservation ────────────────────────────────────────────
// ── Night record (close-night snapshot) ────────────────────
//  Snapshots are deliberately loose-typed (z.any() arrays of
//  whatever Guest/Reservation/PromEvent/Venue look like on the
//  client at the moment of close). Loosening it here means the
//  shape can evolve client-side without forcing a backend rev.
//  The summary IS validated structurally — those numbers feed the
//  XLSX export and need to be trustworthy.
export const nightRecordSummarySchema = z.object({
  totalGuests: z.number().int().min(0),
  totalReservations: z.number().int().min(0),
  grossCommission: z.number().min(0),
  paidToInviters: z.number().min(0),
  fixedFeesEarned: z.number().min(0).default(0),
  netCommission: z.number(),
  influencerCount: z.number().int().min(0),
  byInviteType: z.record(z.string(), z.number()).default({}),
  byVenue: z.record(z.string(), z.object({
    guests: z.number().int().min(0),
    tables: z.number().int().min(0),
  })).default({}),
  byVipType: z.record(z.string(), z.object({
    sold: z.number().int().min(0),
    capacity: z.number().int().min(0),
    revenue: z.number().min(0),
  })).default({}),
  fixedFeesByEvent: z.array(z.object({
    eventId: z.number().int(),
    eventName: z.string(),
    pax: z.number().int().min(0),
    threshold: z.number().int().min(1),
    amount: z.number().min(0),
    earned: z.boolean(),
  })).default([]),
});

export const nightRecordInputSchema = z.object({
  date: isoDate,
  isCorrection: z.boolean().default(false),
  guestsSnapshot: z.array(z.any()).default([]),
  reservationsSnapshot: z.array(z.any()).default([]),
  eventsSnapshot: z.array(z.any()).default([]),
  venuesSnapshot: z.array(z.any()).default([]),
  summary: nightRecordSummarySchema,
});
export type NightRecordInput = z.infer<typeof nightRecordInputSchema>;

export const reservationInputSchema = z.object({
  name: z.string().min(1).max(120),
  venueId: z.number().int(),                    // required
  eventId: z.number().int().nullable().optional(),
  phoneCode: z.string().default('+34'),
  phoneNum: z.string().default(''),
  vipType: z.string().default(''),
  time: hhmm.default('20:00'),
  pax: z.number().int().min(1).max(50).default(2),
  fromInvite: z.boolean().default(false),
  inviterHandle: z.string().default(''),
  inviterPlatform: platform.default('instagram'),
  commissionPct: z.number().min(0).max(100).default(10),
  womanPct: z.number().min(0).max(100).default(0),
  commissionEarner: z.string().default(''),
  eventDate: isoDate.nullable().optional(),
});
export type ReservationInput = z.infer<typeof reservationInputSchema>;

// ── Sync snapshot (first-run migration from local data) ─────
// Lossy on PK: we re-key everything server-side and return the
// mapping so the client can patch its references.
export const snapshotSchema = z.object({
  venues: z.array(venueInputSchema.extend({ clientId: z.number().int() })),
  events: z.array(eventInputSchema.extend({
    clientId: z.number().int(),
    /** Local clientId of the venue, remapped server-side. */
    venueClientId: z.number().int().nullable().optional(),
  })),
  guests: z.array(guestInputSchema.omit({ eventId: true, venueId: true }).extend({
    clientId: z.number().int(),
    eventClientId: z.number().int(),
    venueClientId: z.number().int().nullable().optional(),
    clubEventClientId: z.number().int().nullable().optional(),
  })),
  reservations: z.array(reservationInputSchema.omit({ venueId: true, eventId: true }).extend({
    clientId: z.number().int(),
    venueClientId: z.number().int(),
    eventClientId: z.number().int().nullable().optional(),
  })),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
