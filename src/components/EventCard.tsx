import React from 'react';
import type { PromEvent } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { venueById } from '@/features/summary/calculations';
import { Pill, SlotPill } from './Pill';

interface Props {
  event: PromEvent;
  onClick: () => void;
}

export const EventCard: React.FC<Props> = ({ event: e, onClick }) => {
  const { venues, guests, reservations } = useAppStore((s) => ({
    venues: s.venues, guests: s.guests, reservations: s.reservations,
  }));
  const v = venueById(e.venueId, venues);
  const gc = guests.filter((g) => g.eventId === e.id).reduce((a, g) => a + g.pax, 0);
  const rc = reservations.filter((r) => r.eventId === e.id).length;
  const inv = (e.invitedGuests || []).length;
  const ids = e.selectedSlotIds || [];
  const days = (e.weekdays || [e.weekday || ''])
    .filter(Boolean)
    .map((d) => d.slice(0, 3))
    .join(', ');
  const cardCls = e.isPrivate ? 'private-card' : e.isLateClub ? 'lateclub-card' : '';

  return (
    <div className={`event-card ${cardCls}`} onClick={onClick}>
      <div className="event-thumb">
        <div className="event-thumb-inner">
          <div className="event-thumb-day">{days}</div>
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
          <Pill tone="gray">{v ? v.name : '?'}</Pill>
          {gc > 0 && <Pill tone="blue">{gc} guests</Pill>}
          {rc > 0 && <Pill tone="green">{rc} res.</Pill>}
          {inv > 0 && <Pill tone="teal">{inv} invited</Pill>}
        </div>
      </div>
    </div>
  );
};
