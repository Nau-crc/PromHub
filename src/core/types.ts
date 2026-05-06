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
  venueId: number;
  weekdays: string[];
  weekday: string;
  selectedSlotIds: string[];
  description: string;
  videoUrl: string;
  isPrivate: boolean;
  isLateClub: boolean;
  invitedGuests: string[];
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
  influencer: boolean;
  igHandle: string;
  igPlatform: Platform;
  createdMonth: number;
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
