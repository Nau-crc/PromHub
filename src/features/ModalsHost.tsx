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

  // ── Safe-close ────────────────────────────────────────────
  // When transitioning from one modal to another (e.g. event detail
  // → addGuest), Ionic still fires `onDidDismiss` for the old modal
  // *after* the new mode is already set. A naive `close()` there
  // would wipe `mode = null` and immediately dismiss the new modal.
  //
  // `safeClose(myMode)` only clears the global mode if WE are still
  // the active modal. Otherwise the dismissal was caused by the user
  // navigating to another modal — leave state alone.
  const safeClose = (myModes: NonNullable<typeof mode>[]) => () => {
    const current = useUIStore.getState().mode;
    if (current && myModes.includes(current)) close();
  };

  // Cross-modal navigation: tear down the current modal, wait for the
  // exit animation, then open the next one. Mirrors the MVP's
  // `closeSheet(); setTimeout(()=>openSheet(...), 50)` pattern.
  const TRANSITION_MS = 320;
  const transitionTo = (nextMode: NonNullable<typeof mode>, p: typeof payload = {}) => {
    close();
    setTimeout(() => open(nextMode, p), TRANSITION_MS);
  };

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
        onClose={safeClose(['addEvent', 'editEvent'])}
        editing={editingEvent}
        onRequestNewVenue={() => transitionTo('addVenue')}
      />
      <EventDetailModal
        open={mode === 'eventDetail'}
        onClose={safeClose(['eventDetail'])}
        eventId={mode === 'eventDetail' ? payload.id ?? null : null}
        onEdit={(id) => transitionTo('editEvent', { id })}
        onAddGuest={(eventId) => transitionTo('addGuest', { eventId })}
        onAddRes={(eventId) => transitionTo('addRes', { eventId })}
      />
      <GuestFormModal
        open={mode === 'addGuest' || mode === 'editGuest'}
        onClose={safeClose(['addGuest', 'editGuest'])}
        editing={editingGuest}
        seedEventId={mode === 'addGuest' ? payload.eventId : undefined}
      />
      <GuestDetailModal
        open={mode === 'guestDetail'}
        onClose={safeClose(['guestDetail'])}
        guestId={mode === 'guestDetail' ? payload.id ?? null : null}
        onEdit={(id) => transitionTo('editGuest', { id })}
      />
      <ReservationFormModal
        open={mode === 'addRes' || mode === 'editRes'}
        onClose={safeClose(['addRes', 'editRes'])}
        editing={editingRes}
        seedEventId={mode === 'addRes' ? payload.eventId : undefined}
      />
      <ReservationDetailModal
        open={mode === 'resDetail'}
        onClose={safeClose(['resDetail'])}
        reservationId={mode === 'resDetail' ? payload.id ?? null : null}
        onEdit={(id) => transitionTo('editRes', { id })}
      />
      <VenueFormModal
        open={mode === 'addVenue' || mode === 'editVenue'}
        onClose={safeClose(['addVenue', 'editVenue'])}
        editing={editingVenue}
      />
    </>
  );
};
