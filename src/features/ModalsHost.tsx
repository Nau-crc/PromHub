import React from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useAppStore } from '@/store/useAppStore';
import { EventFormModal } from '@/features/events/EventFormModal';
import { EventDetailModal } from '@/features/events/EventDetailModal';
import { GuestFormModal } from '@/features/guests/GuestFormModal';
import { GuestDetailModal } from '@/features/guests/GuestDetailModal';
import { ReservationFormModal } from '@/features/reservations/ReservationFormModal';
import { ReservationDetailModal } from '@/features/reservations/ReservationDetailModal';
import { VenueFormModal } from '@/features/venues/VenueFormModal';

// ─────────────────────────────────────────────────────────────
//  Single mount-point for every modal in the app, driven by
//  useUIStore. Equivalent to the MVP's `openSheet(mode, data)`.
// ─────────────────────────────────────────────────────────────

export const ModalsHost: React.FC = () => {
  const { mode, payload, open, close } = useUIStore();
  const { events, guests, reservations, venues } = useAppStore((s) => ({
    events: s.events, guests: s.guests, reservations: s.reservations, venues: s.venues,
  }));

  const editingEvent = mode === 'editEvent' && payload.id != null
    ? events.find((e) => e.id === payload.id) ?? null
    : null;
  const editingGuest = mode === 'editGuest' && payload.id != null
    ? guests.find((g) => g.id === payload.id) ?? null
    : null;
  const editingRes = mode === 'editRes' && payload.id != null
    ? reservations.find((r) => r.id === payload.id) ?? null
    : null;
  const editingVenue = mode === 'editVenue' && payload.id != null
    ? venues.find((v) => v.id === payload.id) ?? null
    : null;

  return (
    <>
      <EventFormModal
        open={mode === 'addEvent' || mode === 'editEvent'}
        onClose={close}
        editing={editingEvent}
        onRequestNewVenue={() => open('addVenue')}
      />
      <EventDetailModal
        open={mode === 'eventDetail'}
        onClose={close}
        eventId={mode === 'eventDetail' ? payload.id ?? null : null}
        onEdit={(id) => open('editEvent', { id })}
        onAddGuest={(eventId) => open('addGuest', { eventId })}
        onAddRes={(eventId) => open('addRes', { eventId })}
      />
      <GuestFormModal
        open={mode === 'addGuest' || mode === 'editGuest'}
        onClose={close}
        editing={editingGuest}
        seedEventId={mode === 'addGuest' ? payload.eventId : undefined}
      />
      <GuestDetailModal
        open={mode === 'guestDetail'}
        onClose={close}
        guestId={mode === 'guestDetail' ? payload.id ?? null : null}
        onEdit={(id) => open('editGuest', { id })}
      />
      <ReservationFormModal
        open={mode === 'addRes' || mode === 'editRes'}
        onClose={close}
        editing={editingRes}
        seedEventId={mode === 'addRes' ? payload.eventId : undefined}
      />
      <ReservationDetailModal
        open={mode === 'resDetail'}
        onClose={close}
        reservationId={mode === 'resDetail' ? payload.id ?? null : null}
        onEdit={(id) => open('editRes', { id })}
      />
      <VenueFormModal
        open={mode === 'addVenue' || mode === 'editVenue'}
        onClose={close}
        editing={editingVenue}
      />
    </>
  );
};
