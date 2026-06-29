// ─── Domain types (mirror the MVP shape) ────────────────────

export type Platform = 'instagram' | 'tiktok';

export interface Timeslot {
  id: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  guestCapacity: number;
}

export interface VipType {
  id: string;
  name: string;
  minPax: number;
  maxPax: number;
  tableCapacity: number;
  // `price` is no longer on the venue's VIP type — it's per-event,
  // stored in `PromEvent.vipPrices[name]`. Field retained as
  // optional for backward read-compat with older API responses but
  // shouldn't be relied on going forward.
  price?: number;
}

// (InviteType removed — guests now pick from the event's selected
//  timeslots instead of a separate per-venue invite-type list.)

export interface Venue {
  id: number;
  name: string;
  /** Optional section / type ("Restaurante", "Club", "Beach Club",
   *  …). Free text; the UI fills from the workspace's configurable
   *  list (`AppSettings.venueTypes`). */
  venueType?: string | null;
  // `guestCapacity` and `timeslots` were dropped in the
  // event-centric refactor — slots now live on the event.
  vipTypes: VipType[];
  /** Optional venue contact for WhatsApp dispatch of reservations. */
  phoneCode?: string;
  phoneNum?: string;
}

/** Workspace-level configurable settings. Stored on the shared
 *  tenant; loaded once at startup and exposed via the store. */
export interface AppSettings {
  /** Configurable venue-section list. Order is the display order. */
  venueTypes?: string[];
}

export interface PromEvent {
  id: number;
  name: string;
  /** Optional — events without a venue are allowed (e.g. private dinners). */
  venueId: number | null;
  weekdays: string[];
  weekday: string;
  description: string;
  videoUrl: string;
  isPrivate: boolean;
  isLateClub: boolean;
  invitedGuests: string[];
  /** When true, `eventDate` is the single date the event runs on. */
  isOneTime: boolean;
  /** ISO yyyy-mm-dd. Only meaningful when isOneTime === true. */
  eventDate: string | null;
  /** Per-event timeslot definitions. The sum of `guestCapacity`
   *  across slots is the event's per-night capacity — resets each
   *  night. Slots reference IDs that guests can `timeslotIds`-into. */
  timeslots: Timeslot[];
  /** Per-event price per VIP type, keyed by `VipType.name`. The
   *  venue declares the VIP type identity + table capacity; the
   *  event decides what each table sells for. */
  vipPrices: Record<string, number>;
  /** Minimum guest pax to bring on a single occurrence in order to
   *  earn the fixed fee. null = no fee logic on this event. */
  minGuestsThreshold: number | null;
  /** Fixed € fee awarded on any occurrence that meets the threshold.
   *  null = no fee logic on this event. */
  fixedFee: number | null;
  /** Per-extra-guest bonus € paid once the threshold is met, for
   *  each pax beyond the threshold. null or 0 = no per-extra bonus. */
  perExtraGuestFee: number | null;
  /** Number of photos this event requires per guest (clubs that vet
   *  guests at the door). null = no photos required. The UI shows
   *  a checkbox to toggle between null and a number on the event
   *  form, and surfaces an upload section in the guest form / public
   *  registration form when this is set. */
  photoCount: number | null;
  /** Vercel Blob URL for the event's flyer (image or video). The
   *  /plan flow downloads this on submit so the guest can re-share
   *  it on her IG story. null = no flyer configured. */
  flyerUrl: string | null;
  /** Season start (ISO yyyy-mm-dd). Recurring only. null = open-ended past. */
  seasonStart: string | null;
  /** Season end (ISO yyyy-mm-dd). Recurring only. null = open-ended future. */
  seasonEnd: string | null;
  /** Public-share token (UUID v4). When set, the event has a public
   *  registration link at /register/<token> backed by Vercel KV.
   *  Null until the promoter taps "Share registration link". */
  shareToken: string | null;
}

export interface Guest {
  id: number;
  name: string;
  venueId: number;
  eventId: number | null;
  /** Subset of the event's `selectedSlotIds` this guest is coming to.
   *  Renders as chips ("Comida · Tardeo") wherever invite types used
   *  to render. */
  timeslotIds: string[];
  /** Denormalised display names for the chosen timeslots so chips
   *  keep rendering even if a venue's timeslot is later renamed. */
  timeslotNames: string[];
  pax: number;
  clubEventId: number | null;
  /** Arrived flag for the MAIN event link (`eventId`). */
  checked: boolean;
  /** Cancelled flag for the MAIN event link (`eventId`). */
  cancelled?: boolean;
  /** Arrived flag for the LATE-CLUB event link (`clubEventId`).
   *  Independent of `checked` — she can arrive at dinner but skip
   *  the club, or vice versa. */
  checkedClub?: boolean;
  /** Cancelled flag for the LATE-CLUB event link. Independent of
   *  `cancelled`. */
  cancelledClub?: boolean;
  /** True when she signed up AFTER the event hit capacity. She
   *  doesn't count toward the used capacity and renders in the
   *  "Waitlist" section instead. Promoter promotes by flipping
   *  this to false. */
  waitlisted?: boolean;
  /** Additional events she's invited to the same night, on top of
   *  `eventId` (main) and `clubEventId` (club). Each id here counts
   *  her toward that event's capacity as if it were a main link.
   *  Status flags are inherited from the main attendance for now. */
  extraEventIds?: number[];
  influencer: boolean;
  igHandle: string;
  igPlatform: Platform;
  /** Vercel Blob URLs uploaded for this guest (only filled when the
   *  linked event has `photoCount` set). Order is upload order. */
  photos?: string[];
  createdMonth: number;
  /** ISO yyyy-mm-dd date when the guest record was created. */
  createdAt: string;
  /** Specific occurrence date of the linked event (yyyy-mm-dd).
   *  null when the guest is not tied to any event. */
  eventDate: string | null;
  /** When the guest was imported from a public registration form,
   *  this holds the submission's UUID so we can dedup imports. */
  submissionId?: string;
  /** Free-form notes — used today by the public form so guests can
   *  add dietary/allergy/+1 info. Optional everywhere else. */
  notes?: string;
}

export interface Reservation {
  id: number;
  name: string;
  phoneCode: string;
  phoneNum: string;
  venueId: number;
  /** Optional informational link to an event scheduled that night.
   *  Reservations are NOT functionally bound to events. */
  eventId: number | null;
  vipType: string;
  /** @deprecated Reservations are no longer tied to a venue timeslot.
   *  Kept on the type for backwards-compat; new records leave it as ''. */
  slotId: string;
  /** "HH:MM" 24h. Reservations have a free time, not a venue timeslot. */
  time: string;
  pax: number;
  fromInvite: boolean;
  inviterHandle: string;
  inviterPlatform: Platform;
  commissionPct: number;
  womanPct: number;
  commissionEarner: string;
  /** ISO yyyy-mm-dd date when the reservation was created. */
  createdAt: string;
  /** Specific occurrence date of the linked event (yyyy-mm-dd).
   *  null when the reservation is not tied to any event. */
  eventDate: string | null;
}

// ─── Night records (closed-night snapshots) ─────────────────
//
// Pre-calculated aggregates stored alongside the full snapshot.
// Once a night is closed, these numbers are authoritative forever
// — venue prices and event configs can drift later, but a closed
// night's totals never re-derive.
export interface NightRecordSummary {
  totalGuests: number;
  totalReservations: number;
  grossCommission: number;
  paidToInviters: number;
  /** Sum of fixed fees earned across every event tonight whose
   *  guest pax met its `minGuestsThreshold`. Added to gross when
   *  computing `netCommission`. */
  fixedFeesEarned: number;
  /** netCommission = grossCommission + fixedFeesEarned - paidToInviters */
  netCommission: number;
  influencerCount: number;
  byInviteType: Record<string, number>;
  byVenue: Record<string, { guests: number; tables: number }>;
  byVipType: Record<string, { sold: number; capacity: number; revenue: number }>;
  /** Per-event fixed-fee detail. One entry per event that has fee
   *  logic configured, even if not earned this night (so the report
   *  can show "0 / 10 pax, fee €150 pending"). */
  fixedFeesByEvent: Array<{
    eventId: number;
    eventName: string;
    pax: number;
    threshold: number;
    amount: number;
    earned: boolean;
  }>;
}

export interface NightRecord {
  id: string;             // uuid
  date: string;           // yyyy-mm-dd
  closedAt: string;       // ISO 8601
  isCorrection: boolean;
  guestsSnapshot: Guest[];
  reservationsSnapshot: Reservation[];
  eventsSnapshot: PromEvent[];
  venuesSnapshot: Venue[];
  summary: NightRecordSummary;
}

/**
 * Legacy on-disk snapshot from when the app was Preferences-backed.
 * Kept around so the first launch after the backend migration can
 * read it once, push it to /api/v1/sync, then drop it. The next-id
 * counters are ignored server-side (Postgres SERIAL assigns IDs).
 */
export interface AppDataSnapshot {
  venues: Venue[];
  events: PromEvent[];
  guests: Guest[];
  reservations: Reservation[];
  nextVenueId?: number;
  nextEventId?: number;
  nextGuestId?: number;
  nextResId?: number;
  nextTsId?: number;
  nextVipId?: number;
  invTypeNextId?: number;
}
