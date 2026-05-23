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
//    - JSONB for "value object" lists (timeslots, vipTypes,
//      inviteTypes inside a venue): these are read together with
//      the venue 99% of the time, never queried independently,
//      and modeling them as separate tables adds joins without
//      benefit at this scale.
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const venues = pgTable('venues', {
  id: serial('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  guestCapacity: integer('guest_capacity').default(0).notNull(),
  phoneCode: text('phone_code'),
  phoneNum: text('phone_num'),
  /** Array of { id, name, startTime, endTime, guestCapacity }. */
  timeslots: jsonb('timeslots').$type<Array<{
    id: string; name: string; startTime: string; endTime: string; guestCapacity: number;
  }>>().default([]).notNull(),
  /** Array of { id, name, price, minPax, maxPax, tableCapacity }. */
  vipTypes: jsonb('vip_types').$type<Array<{
    id: string; name: string; price: number; minPax: number; maxPax: number; tableCapacity: number;
  }>>().default([]).notNull(),
  /** Array of { id, name }. */
  inviteTypes: jsonb('invite_types').$type<Array<{ id: string; name: string }>>().default([]).notNull(),
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
  selectedSlotIds: text('selected_slot_ids').array().default([]).notNull(),
  description: text('description').default('').notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
  isLateClub: boolean('is_late_club').default(false).notNull(),
  invitedGuests: text('invited_guests').array().default([]).notNull(),
  isOneTime: boolean('is_one_time').default(false).notNull(),
  /** ISO date; one-time events only. */
  eventDate: date('event_date'),
  capacity: integer('capacity'),
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
  inviteTypeIds: text('invite_type_ids').array().default([]).notNull(),
  inviteTypeNames: text('invite_type_names').array().default([]).notNull(),
  pax: integer('pax').default(1).notNull(),
  checked: boolean('checked').default(false).notNull(),
  cancelled: boolean('cancelled').default(false).notNull(),
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

// Re-exports for type inference at the call site
export type Tenant = typeof tenants.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type GuestRow = typeof guests.$inferSelect;
export type ReservationRow = typeof reservations.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
