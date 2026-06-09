import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PromEvent } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { eventScheduleLabel, venueById, isGuestAttendingEvent } from '@/features/summary/calculations';
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
  const { t } = useTranslation();
  const { venues, guests, reservations } = useAppStore((s) => ({
    venues: s.venues, guests: s.guests, reservations: s.reservations,
  }));
  const v = e.venueId != null ? venueById(e.venueId, venues) : undefined;

  // Per-occurrence counters when a date is given; otherwise totals.
  // Permissive: rows with no eventDate (legacy / unpinned) count
  // toward every occurrence so they don't silently disappear from
  // the home cards. Capacity uses a stricter rule elsewhere.
  const matchByDate = (date: string | null) =>
    !occurrenceDate || !date || date === occurrenceDate;

  // A guest counts toward this card if she's ATTENDING the event
  // — that is, linked via her main or club id AND not cancelled
  // for THAT specific attendance. (A guest who cancelled the
  // dinner but still plans to come to the after-club only counts
  // once, on the club card.)
  const gc = guests
    .filter((g) => isGuestAttendingEvent(g, e.id) && matchByDate(g.eventDate))
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
          <span style={{ position: 'absolute', right: 8, top: 8 }} className="pill pill-pink">{t('common.private')}</span>
        )}
        {e.isLateClub && (
          <span style={{ position: 'absolute', right: 8, top: 8 }} className="pill pill-purple">{t('common.club')}</span>
        )}
      </div>
      <div className="event-body">
        <div className="event-meta-row">
          {ids.map((id) => <SlotPill key={id} slotId={id} />)}
          {/* Venue name is data, not a category tag — moved out of
              the chip row so it doesn't sit next to Private / Late
              Club / etc. as if it were one of them. */}
          {gc > 0 && (
            <Pill tone="blue">
              {e.capacity ? `${gc}/${e.capacity}` : `${gc}`} {t('summary.guests').toLowerCase()}
            </Pill>
          )}
          {rc > 0 && <Pill tone="green">{t('onboarding.legend.sampleReservations', { count: rc })}</Pill>}
          {inv > 0 && <Pill tone="teal">{t('onboarding.legend.sampleInvited', { count: inv })}</Pill>}
        </div>
        {v && (
          <div style={{
            fontSize: 11, color: 'var(--color-text-secondary)',
            marginTop: 4,
          }}>
            {t('eventDetail.at')} {v.name}
          </div>
        )}
      </div>
    </div>
  );
};
