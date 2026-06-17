import {
  pgTable, serial, text, integer, boolean, date, jsonb,
  uuid, timestamp, numeric, index, foreignKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────
//  PromHub database schema.
//
//  Design notes:
//    - Tenancy: every promoter is a `tenant`. Until we add real
//      auth, a tenant is identified by a device-generated UUID
//      sent via the X-Tenant-Id header. When auth ships, we'll
//      add a `user_id` column and migrate device-tenants to
//      user-owned tenants in one query.
//    - JSONB for "value object" lists (timeslots, vipTypes
//      inside a venue): these are read together with the venue
//      99% of the time, never queried independently, and modeling
//      them as separate tables adds joins without benefit at this
//      scale.
//    - Soft FK strategy: events.venueId → ON DELETE SET NULL
//      (the cascade rules of "delete venue keeps past events"
//      are enforced at the service layer, not blindly at the
//      DB level — we need date-aware logic the DB can't do).
//    - All amount fields stay numeric/integer to keep the
//      MVP's commission formulas byte-exact.
// ─────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** UUID generated client-side on first launch, stored in
   *  Capacitor Preferences. Used to lookup the tenant on every
   *  request. Unique. */
  deviceId: text('device_id').notNull().unique(),
  /** Optional display name (filled when auth lands). */
  displayName: text('display_name'),
  /** Workspace-level configurable settings — `{ venueTypes: [...] }`
   *  and other promoter-managed preferences. Stored as a single
   *  jsonb so we don't need a new table per setting. */
  settings: jsonb('settings').$type<{
    venueTypes?: string[];
  }>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const venues = pgTable('venues', {
  id: serial('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** Type/section the venue belongs to ("Club", "Restaurante",
   *  "Beach Club", etc.). Free-text but expected to match one of
   *  `tenants.settings.venueTypes`. NULL = uncategorised. */
  venueType: text('venue_type'),
  phoneCode: text('phone_code'),
  phoneNum: text('phone_num'),
  // Legacy columns dropped in 0008:
  //   - guest_capacity (venue-level cap was redundant — slots own capacity now)
  //   - timeslots (moved to events; each event defines its own slots)
  /** Array of { id, name, minPax, maxPax, tableCapacity }.
   *  Prices moved to the EVENT (each event sets its own price per
   *  VIP type), so this row only carries identity + pax range +
   *  how many tables of this type exist at the venue. */
  vipTypes: jsonb('vip_types').$type<Array<{
    id: string; name: string; minPax: number; maxPax: number; tableCapacity: number;
  }>>().default([]).notNull(),
  // (Legacy `invite_types` jsonb dropped in 0003 — guests now pick
  // from the event's selected timeslots directly.)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTenant: index('venues_tenant_idx').on(t.tenantId),
}));

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  venueId: integer('venue_id').references(() => venues.id, { onDelete: 'set null' }),
  weekdays: text('weekdays').array().default([]).notNull(),
  // Legacy: `selected_slot_ids` (text[]) dropped in 0008. Events
  // now own their timeslots directly via the `timeslots` jsonb
  // below.
  description: text('description').default('').notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
  isLateClub: boolean('is_late_club').default(false).notNull(),
  invitedGuests: text('invited_guests').array().default([]).notNull(),
  isOneTime: boolean('is_one_time').default(false).notNull(),
  /** ISO date; one-time events only. */
  eventDate: date('event_date'),
  // Legacy: `capacity` (integer) dropped in 0008. Per-night capacity
  // is the sum of `timeslots[].guestCapacity` for this event — slot
  // capacities are the granular truth and reset each night.
  /** Per-event timeslot definitions. Each slot has its own
   *  per-night capacity. The event-level pax check (against
   *  `minGuestsThreshold`) sums across slots for the date. */
  timeslots: jsonb('timeslots').$type<Array<{
    id: string; name: string; startTime: string; endTime: string; guestCapacity: number;
  }>>().default([]).notNull(),
  /** Per-event VIP table prices: { [vipTypeName]: price-in-€ }.
   *  The VIP type identity / capacity stays on the venue; the price
   *  is event-scoped so the same venue can sell different events
   *  at different rates. */
  vipPrices: jsonb('vip_prices').$type<Record<string, number>>().default({}).notNull(),
  /** Minimum guest pax the promoter must bring on a single
   *  occurrence to earn the fixed fee. NULL = no threshold (no
   *  fee logic at all for this event). Per-occurrence: the count
   *  resets each night. */
  minGuestsThreshold: integer('min_guests_threshold'),
  /** Fixed fee (€) the promoter earns on any occurrence that meets
   *  `minGuestsThreshold`. NULL = no fee. Stored to 2 decimals so
   *  the snapshot maths stays byte-exact with the commission column. */
  fixedFee: numeric('fixed_fee', { precision: 8, scale: 2 }),
  /** Per-extra-guest bonus (€) on top of the fixed fee — kicks in
   *  once the threshold is met, paid for each pax BEYOND the
   *  threshold. NULL or 0 = no per-extra bonus (only the flat fee).
   *  Example: threshold=10, fixedFee=150, perExtraGuestFee=5 → at
   *  15 pax she earns 150 + (15-10)*5 = 175. */
  perExtraGuestFee: numeric('per_extra_guest_fee', { precision: 8, scale: 2 }),
  seasonStart: date('season_start'),
  seasonEnd: date('season_end'),
  /** Public-form share token (UUID v4). Nullable for legacy rows. */
  shareToken: uuid('share_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTenant: index('events_tenant_idx').on(t.tenantId),
  byVenue: index('events_venue_idx').on(t.venueId),
}));

export const guests = pgTable('guests', {
  id: serial('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  /** Guests always belong to an event (validated server-side). */
  eventId: integer('event_id').notNull(),
  venueId: integer('venue_id'),
  /** Optional secondary link — "going to the club later". */
  clubEventId: integer('club_event_id'),
  name: text('name').notNull(),
  /** Which of the event's selected timeslots this guest is coming to.
   *  Replaces the old `invite_type_ids` / `invite_type_names` pair —
   *  invite types were a separate concept that mapped 1:1 onto
   *  timeslots in practice, so we collapsed them. */
  timeslotIds: text('timeslot_ids').array().default([]).notNull(),
  /** Denormalised display names of the chosen timeslots ("Comida",
   *  "Tardeo") — kept so guest lists keep rendering correctly even
   *  if a venue's timeslot is later renamed/deleted. */
  timeslotNames: text('timeslot_names').array().default([]).notNull(),
  pax: integer('pax').default(1).notNull(),
  /** Arrived flag for the MAIN event link (`event_id`). */
  checked: boolean('checked').default(false).notNull(),
  /** Cancelled flag for the MAIN event link (`event_id`). */
  cancelled: boolean('cancelled').default(false).notNull(),
  /** Arrived flag for the LATE-CLUB event link (`club_event_id`).
   *  Independent of `checked` — a guest can arrive at the dinner
   *  but skip the club, or the other way round. */
  checkedClub: boolean('checked_club').default(false).notNull(),
  /** Cancelled flag for the LATE-CLUB event link. Independent of
   *  `cancelled`. */
  cancelledClub: boolean('cancelled_club').default(false).notNull(),
  /** Waitlist flag — true means the guest registered AFTER the event
   *  hit its capacity. She doesn't count toward `used` and is shown
   *  in a separate "Waitlist" section. The promoter can promote her
   *  by flipping this back to false (e.g. when someone cancels). */
  waitlisted: boolean('waitlisted').default(false).notNull(),
  /** Additional events the same guest is invited to the same night,
   *  on top of `event_id` (main) and `club_event_id` (late club).
   *  Each id here counts her toward that event's capacity exactly
   *  as if it were her main link. Status (cancelled/checked) is
   *  inherited from the main flags for now — we can split per-extra
   *  later if the promoter needs it. */
  extraEventIds: integer('extra_event_ids').array().default([]).notNull(),
  influencer: boolean('influencer').default(false).notNull(),
  igHandle: text('ig_handle').default('').notNull(),
  igPlatform: text('ig_platform', { enum: ['instagram', 'tiktok'] }).default('instagram').notNull(),
  notes: text('notes'),
  /** Specific occurrence of the linked event. */
  eventDate: date('event_date'),
  /** When imported from the public form, the original submission UUID. */
  submissionId: text('submission_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTenant: index('guests_tenant_idx').on(t.tenantId),
  byEvent: index('guests_event_idx').on(t.eventId),
  eventFk: foreignKey({
    columns: [t.eventId],
    foreignColumns: [events.id],
  }).onDelete('cascade'),
  venueFk: foreignKey({
    columns: [t.venueId],
    foreignColumns: [venues.id],
  }).onDelete('set null'),
}));

export const reservations = pgTable('reservations', {
  id: serial('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  /** Reservations always belong to a venue. */
  venueId: integer('venue_id').notNull().references(() => venues.id, { onDelete: 'cascade' }),
  /** Optional informational link to an event happening that night. */
  eventId: integer('event_id').references(() => events.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  phoneCode: text('phone_code').default('+34').notNull(),
  phoneNum: text('phone_num').default('').notNull(),
  vipType: text('vip_type').default('').notNull(),
  /** "HH:MM" 24h — reservations are free-form by time now. */
  time: text('time').default('20:00').notNull(),
  pax: integer('pax').default(2).notNull(),
  fromInvite: boolean('from_invite').default(false).notNull(),
  inviterHandle: text('inviter_handle').default('').notNull(),
  inviterPlatform: text('inviter_platform', { enum: ['instagram', 'tiktok'] }).default('instagram').notNull(),
  commissionPct: numeric('commission_pct', { precision: 5, scale: 2 }).default('10').notNull(),
  womanPct: numeric('woman_pct', { precision: 5, scale: 2 }).default('0').notNull(),
  commissionEarner: text('commission_earner').default('').notNull(),
  eventDate: date('event_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTenant: index('reservations_tenant_idx').on(t.tenantId),
  byVenue: index('reservations_venue_idx').on(t.venueId),
}));

// ─── Relations (used by Drizzle's relational query API) ─────
export const tenantsRelations = relations(tenants, ({ many }) => ({
  venues: many(venues),
  events: many(events),
  guests: many(guests),
  reservations: many(reservations),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  tenant: one(tenants, { fields: [venues.tenantId], references: [tenants.id] }),
  events: many(events),
  reservations: many(reservations),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  tenant: one(tenants, { fields: [events.tenantId], references: [tenants.id] }),
  venue: one(venues, { fields: [events.venueId], references: [venues.id] }),
  guests: many(guests),
}));

export const guestsRelations = relations(guests, ({ one }) => ({
  tenant: one(tenants, { fields: [guests.tenantId], references: [tenants.id] }),
  event: one(events, { fields: [guests.eventId], references: [events.id] }),
  venue: one(venues, { fields: [guests.venueId], references: [venues.id] }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  tenant: one(tenants, { fields: [reservations.tenantId], references: [tenants.id] }),
  venue: one(venues, { fields: [reservations.venueId], references: [venues.id] }),
  event: one(events, { fields: [reservations.eventId], references: [events.id] }),
}));

// ─── Submissions (public registration form) ─────────────────
//
//  When the promoter shares an event's public link
//  (`/register/<shareToken>`), guests fill in a form and the
//  result lands here. The promoter's app pulls these into the
//  `guests` table on demand (so they can still review before
//  the guest officially counts toward capacity).
//
//  No tenant_id — submissions are scoped by event, and events
//  carry the shared workspace anyway.
export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  /** Specific occurrence date this sign-up is for (yyyy-mm-dd).
   *  For one-time events this equals `events.event_date`. For
   *  recurring events it's whichever night the promoter shared
   *  the link for. Nullable for legacy submissions made before
   *  the column existed. */
  eventDate: date('event_date'),
  name: text('name').notNull(),
  pax: integer('pax').default(1).notNull(),
  igHandle: text('ig_handle').default('').notNull(),
  igPlatform: text('ig_platform', { enum: ['instagram', 'tiktok'] }).default('instagram').notNull(),
  notes: text('notes').default('').notNull(),
  /** When the promoter pulled this submission into the guests
   *  list. Null = not yet imported (used for dedup on re-pulls). */
  importedAt: timestamp('imported_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byEvent: index('submissions_event_idx').on(t.eventId),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  event: one(events, { fields: [submissions.eventId], references: [events.id] }),
}));

// ─── Night records (closed-night snapshots) ─────────────────
//
//  When the promoter taps "Close night" we freeze a full snapshot
//  of guests / reservations / events / venues for that date AND
//  store the pre-calculated summary aggregates inline. The summary
//  is the authoritative number forever — venue prices and event
//  configs can change later, but a closed night's totals must not.
//
//  We allow multiple records per `date` for corrections (the spec's
//  `isCorrection` flow). The latest `closedAt` for a given date is
//  treated as the canonical one by the UI; older corrections stay
//  in the table for audit. No `tenant_id` for the same reason as
//  submissions — shared workspace.
export const nightRecords = pgTable('night_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** yyyy-mm-dd — the calendar date this record is FOR (not when
   *  it was closed; that's `closedAt`). */
  date: date('date').notNull(),
  /** When the promoter pressed "Close night" — the act of closing. */
  closedAt: timestamp('closed_at', { withTimezone: true }).defaultNow().notNull(),
  /** True when this row is a correction of an earlier close for
   *  the same `date`. The UI surfaces the most recent. */
  isCorrection: boolean('is_correction').default(false).notNull(),
  /** Frozen snapshots — never re-derived. Stored as JSONB so the
   *  shapes match the runtime Guest/Reservation/PromEvent/Venue
   *  types byte-for-byte (we serialize on close, deserialize on
   *  read). */
  guestsSnapshot: jsonb('guests_snapshot').default([]).notNull(),
  reservationsSnapshot: jsonb('reservations_snapshot').default([]).notNull(),
  eventsSnapshot: jsonb('events_snapshot').default([]).notNull(),
  venuesSnapshot: jsonb('venues_snapshot').default([]).notNull(),
  /** Pre-calculated aggregates. Never recomputed. */
  summary: jsonb('summary').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byDate: index('night_records_date_idx').on(t.date),
  byClosedAt: index('night_records_closed_at_idx').on(t.closedAt),
}));

export const nightRecordsRelations = relations(nightRecords, () => ({
  // No relations — snapshots are self-contained by design.
}));

// Re-exports for type inference at the call site
export type Tenant = typeof tenants.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type GuestRow = typeof guests.$inferSelect;
export type ReservationRow = typeof reservations.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type NightRecordRow = typeof nightRecords.$inferSelect;
