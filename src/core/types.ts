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
  price: number;        // € per table
  minPax: number;
  maxPax: number;
  tableCapacity: number;
}

export interface InviteType {
  id: string;
  name: string;
}

export interface Venue {
  id: number;
  name: string;
  guestCapacity: number;
  timeslots: Timeslot[];
  vipTypes: VipType[];
  inviteTypes: InviteType[];
}

export interface PromEvent {
  id: number;
  name: string;
  /** Optional — events without a venue are allowed (e.g. private dinners). */
  venueId: number | null;
  weekdays: string[];
  weekday: string;
  selectedSlotIds: string[];
  description: string;
  videoUrl: string;
  isPrivate: boolean;
  isLateClub: boolean;
  invitedGuests: string[];
  /** When true, `eventDate` is the single date the event runs on. */
  isOneTime: boolean;
  /** ISO yyyy-mm-dd. Only meaningful when isOneTime === true. */
  eventDate: string | null;
  /** Maximum guests per occurrence. 0 / null = no cap. */
  capacity: number | null;
  /** Season start (ISO yyyy-mm-dd). Recurring only. null = open-ended past. */
  seasonStart: string | null;
  /** Season end (ISO yyyy-mm-dd). Recurring only. null = open-ended future. */
  seasonEnd: string | null;
}

export interface Guest {
  id: number;
  name: string;
  venueId: number;
  eventId: number | null;
  inviteTypeIds: string[];
  inviteTypeNames: string[];
  pax: number;
  clubEventId: number | null;
  checked: boolean;
  /** Guest cancelled (no-show before the night, or expressly cancelled). */
  cancelled?: boolean;
  influencer: boolean;
  igHandle: string;
  igPlatform: Platform;
  createdMonth: number;
  /** ISO yyyy-mm-dd date when the guest record was created. */
  createdAt: string;
  /** Specific occurrence date of the linked event (yyyy-mm-dd).
   *  null when the guest is not tied to any event. */
  eventDate: string | null;
}

export interface Reservation {
  id: number;
  name: string;
  phoneCode: string;
  phoneNum: string;
  venueId: number;
  eventId: number | null;
  vipType: string;
  slotId: string;
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

export interface AppDataSnapshot {
  venues: Venue[];
  events: PromEvent[];
  guests: Guest[];
  reservations: Reservation[];
  nextVenueId: number;
  nextEventId: number;
  nextGuestId: number;
  nextResId: number;
  nextTsId: number;
  nextVipId: number;
  invTypeNextId: number;
}
