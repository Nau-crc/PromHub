import React from 'react';
import type { PromEvent } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { eventScheduleLabel, venueById } from '@/features/summary/calculations';
import { Pill, SlotPill } from './Pill';

interface Props {
  event: PromEvent;
  /**
   * If provided, counters and the date label refer to that specific
   * occurrence. Used by HomePage to show today's instance only.
   * If omitted, the card shows the whole-event totals (Events page).
   */
  occurrenceDate?: string;
  onClick: () => void;
}

export const EventCard: React.FC<Props> = ({ event: e, occurrenceDate, onClick }) => {
  const { venues, guests, reservations } = useAppStore((s) => ({
    venues: s.venues, guests: s.guests, reservations: s.reservations,
  }));
  const v = e.venueId != null ? venueById(e.venueId, venues) : undefined;

  // Per-occurrence counters when a date is given; otherwise totals.
  const matchByDate = (date: string | null) =>
    occurrenceDate ? date === occurrenceDate : true;

  const gc = guests
    .filter((g) => g.eventId === e.id && matchByDate(g.eventDate))
    .reduce((a, g) => a + g.pax, 0);
  const rc = reservations
    .filter((r) => r.eventId === e.id && matchByDate(r.eventDate))
    .length;
  const inv = (e.invitedGuests || []).length;
  const ids = e.selectedSlotIds || [];

  // Date label:
  //  - If we know the occurrence, show that exact date.
  //  - Otherwise: show the schedule (e.g. "Sat/Sun · until Sep 30" or "Jul 15").
  const dateLabel = occurrenceDate
    ? new Date(occurrenceDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : eventScheduleLabel(e);

  const cardCls = e.isPrivate ? 'private-card' : e.isLateClub ? 'lateclub-card' : '';

  return (
    <div className={`event-card ${cardCls}`} onClick={onClick}>
      <div className="event-thumb">
        <div className="event-thumb-inner">
          <div className="event-thumb-day">{dateLabel || '—'}</div>
          <div className="event-thumb-name">{e.name}</div>
        </div>
        {e.isPrivate && (
          <span style={{ position: 'absolute', right: 8, top: 8 }} className="pill pill-pink">Private</span>
        )}
        {e.isLateClub && (
          <span style={{ position: 'absolute', right: 8, top: 8 }} className="pill pill-purple">🌙 Club</span>
        )}
      </div>
      <div className="event-body">
        <div className="event-meta-row">
          {ids.map((id) => <SlotPill key={id} slotId={id} />)}
          {v && <Pill tone="gray">{v.name}</Pill>}
          {gc > 0 && (
            <Pill tone="blue">
              {e.capacity ? `${gc}/${e.capacity} guests` : `${gc} guests`}
            </Pill>
          )}
          {rc > 0 && <Pill tone="green">{rc} res.</Pill>}
          {inv > 0 && <Pill tone="teal">{inv} invited</Pill>}
        </div>
      </div>
    </div>
  );
};
