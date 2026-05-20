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
  price: z.number().min(0),
  minPax: z.number().int().min(1),
  maxPax: z.number().int().min(1),
  tableCapacity: z.number().int().min(0),
});

const inviteTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

export const venueInputSchema = z.object({
  name: z.string().min(1).max(120),
  guestCapacity: z.number().int().min(0).default(0),
  phoneCode: z.string().nullable().optional(),
  phoneNum: z.string().nullable().optional(),
  timeslots: z.array(timeslotSchema).default([]),
  vipTypes: z.array(vipTypeSchema).default([]),
  inviteTypes: z.array(inviteTypeSchema).default([]),
});
export type VenueInput = z.infer<typeof venueInputSchema>;

// ── Event ──────────────────────────────────────────────────
export const eventInputSchema = z.object({
  name: z.string().min(1).max(120),
  venueId: z.number().int().nullable().optional(),
  weekdays: z.array(z.string()).default([]),
  selectedSlotIds: z.array(z.string()).default([]),
  description: z.string().max(1000).default(''),
  isPrivate: z.boolean().default(false),
  isLateClub: z.boolean().default(false),
  invitedGuests: z.array(z.string()).default([]),
  isOneTime: z.boolean().default(false),
  eventDate: isoDate.nullable().optional(),
  capacity: z.number().int().min(0).nullable().optional(),
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
  inviteTypeIds: z.array(z.string()).default([]),
  inviteTypeNames: z.array(z.string()).default([]),
  pax: z.number().int().min(1).max(50).default(1),
  checked: z.boolean().default(false),
  cancelled: z.boolean().default(false),
  influencer: z.boolean().default(false),
  igHandle: z.string().max(60).default(''),
  igPlatform: platform.default('instagram'),
  notes: z.string().max(280).nullable().optional(),
  eventDate: isoDate.nullable().optional(),
  submissionId: z.string().nullable().optional(),
});
export type GuestInput = z.infer<typeof guestInputSchema>;

// ── Reservation ────────────────────────────────────────────
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
