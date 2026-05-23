import React, { useEffect, useMemo, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import type { Guest, Platform, PromEvent } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { today } from '@/core/constants';
import { isoDay } from '@/core/utils/date';
import {
  eventCapacity, lateClubEvents, nextOccurrence, occurs, venueById,
} from '@/features/summary/calculations';
import { Avatar } from '@/components/Avatar';
import { OccurrencePicker } from '@/components/OccurrencePicker';
import { SelectField } from '@/components/SelectField';
import { SheetHeader } from '@/components/SheetHeader';
import { PlatformPicker } from '@/components/PlatformPicker';
import { NumberField } from '@/components/NumberField';
import { sendViaSocial } from '@/services/messaging';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Guest | null;
  /** Pre-seed event when launched from event detail */
  seedEventId?: number;
}

export const GuestFormModal: React.FC<Props> = ({ open, onClose, editing, seedEventId }) => {
  const { venues, events, guests, upsertGuest, removeGuest } = useAppStore((s) => ({
    venues: s.venues, events: s.events, guests: s.guests,
    upsertGuest: s.upsertGuest, removeGuest: s.removeGuest,
  }));
  const confirm = useConfirm();

  const askDelete = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: `Delete ${editing.name}?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) { removeGuest(editing.id); onClose(); }
  };

  const [name, setName] = useState('');
  const [venueId, setVenueId] = useState<number | null>(null);
  const [pax, setPax] = useState<number | null>(1);
  /** Which of the picked event's timeslots she's coming to. Replaces
   *  the old "invitation types" concept — same chip-picker UX,
   *  driven now by the event's `selectedSlotIds`. */
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [eventDate, setEventDate] = useState<string>('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [handle, setHandle] = useState('');
  const [influencer, setInfluencer] = useState(false);
  const [goingToClub, setGoingToClub] = useState(false);
  const [clubEventId, setClubEventId] = useState<number | null>(null);

  // ── Helpers (declared before useEffect that uses them) ─────────
  //
  // Sort key used both for ordering the event picker and for
  // picking the default event when the venue changes. For one-time
  // events the date IS the key; for recurring events it's the next
  // occurrence on or after today. Past one-time / closed-season
  // recurring events sort last via the '9999-…' sentinel.
  function eventSortKey(e: PromEvent, todayIso: string): string {
    if (e.isOneTime) return e.eventDate && e.eventDate >= todayIso
      ? e.eventDate
      : `9999-${e.eventDate ?? '00-00'}`; // past one-times pushed down
    return nextOccurrence(e, todayIso) ?? '9999-12-31';
  }

  // Default eventDate to surface when the user (re)selects an event.
  // One-time events lock the date; recurring default to the next
  // occurrence on or after today, or whatever the guest already had.
  function initialEventDate(evId: number | null, prevDate: string | null): string {
    if (evId == null) return '';
    const ev = events.find((e) => e.id === evId);
    if (!ev) return '';
    if (ev.isOneTime) return ev.eventDate ?? '';
    if (prevDate) return prevDate;
    return nextOccurrence(ev, isoDay(today())) ?? '';
  }

  // Returns the event the picker should default to when a venue is
  // (re)selected: the next upcoming event AT THAT VENUE. Falls back
  // to the very first event at the venue if nothing's upcoming.
  function nextEventAtVenue(vid: number | null): number | null {
    if (vid == null) return null;
    const todayIso = isoDay(today());
    const candidates = events
      .filter((e) => e.venueId === vid)
      .sort((a, b) => eventSortKey(a, todayIso).localeCompare(eventSortKey(b, todayIso)));
    return candidates[0]?.id ?? null;
  }

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');

    // Seed venue from: existing guest → seeded event's venue → first.
    // This keeps "+ Guest" from EventDetail aligned with that event's venue.
    const seedEv = seedEventId != null ? events.find((e) => e.id === seedEventId) : null;
    const startVenue = editing?.venueId ?? seedEv?.venueId ?? venues[0]?.id ?? null;
    setVenueId(startVenue);

    setPax(editing?.pax ?? 1);
    setSlotIds(editing ? [...(editing.timeslotIds || [])] : []);

    // Seed event from: existing guest → explicit seed → auto-pick the
    // next upcoming event at the seeded venue. No more empty picker
    // for brand-new guests.
    const startEv = editing
      ? editing.eventId
      : (seedEventId ?? nextEventAtVenue(startVenue));
    setEventId(startEv);
    setEventDate(initialEventDate(startEv, editing?.eventDate ?? null));

    setPlatform(editing?.igPlatform ?? 'instagram');
    setHandle(editing?.igHandle ?? '');
    setInfluencer(!!editing?.influencer);
    setGoingToClub(!!editing?.clubEventId);
    setClubEventId(editing?.clubEventId ?? null);
  }, [open, editing, seedEventId, venues, events]); // events: needed for nextEventAtVenue

  const v = useMemo(() => (venueId != null ? venueById(venueId, venues) : undefined), [venueId, venues]);
  const lateEvents: PromEvent[] = useMemo(() => lateClubEvents(events), [events]);

  // Timeslots offered to the chip picker = the EVENT's selected slots
  // resolved against the venue's timeslot definitions. Resolving via
  // the venue means we always have name + start/end for display.
  const eventTimeslots = useMemo(() => {
    if (!v || !eventId) return [];
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return [];
    const slotIdSet = new Set(ev.selectedSlotIds || []);
    return (v.timeslots || []).filter((ts) => slotIdSet.has(ts.id));
  }, [v, eventId, events]);

  // Events to show in the picker — only the ones at the selected
  // venue, ordered by their next occurrence so the soonest is on top.
  const venueEvents: PromEvent[] = useMemo(() => {
    if (venueId == null) return [];
    const todayIso = isoDay(today());
    return events
      .filter((e) => e.venueId === venueId)
      .slice()
      .sort((a, b) => eventSortKey(a, todayIso).localeCompare(eventSortKey(b, todayIso)));
    // eventSortKey is pure (declared at module scope of the component),
    // safe to reference without an extra dependency.
  }, [events, venueId]);

  const onPickEvent = (id: number | null) => {
    setEventId(id);
    setEventDate(initialEventDate(id, null));
    // Each event has its own timeslot list, so any previously-picked
    // slot ids are meaningless for the new event. Reset to empty so
    // the user explicitly picks for this event.
    setSlotIds([]);
  };

  const selectedEvent = eventId != null ? events.find((e) => e.id === eventId) : null;
  const eventDateValid = !selectedEvent
    || (selectedEvent.isOneTime
        ? selectedEvent.eventDate === eventDate
        : !!eventDate && occurs(selectedEvent, eventDate));

  const onVenueChange = (id: number) => {
    setVenueId(id);
    setSlotIds([]); // event changes below, so any old slot pins are stale
    // The previously-selected event probably belongs to a different
    // venue now. Re-anchor on the next upcoming event at the new
    // venue so the user doesn't have to re-pick manually.
    const nextEvId = nextEventAtVenue(id);
    setEventId(nextEvId);
    setEventDate(initialEventDate(nextEvId, null));
  };

  const toggleSlot = (id: string) =>
    setSlotIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { alert('Name is required.'); return; }
    // Per the data model a guest belongs to an event. We block saving
    // until the user has picked one — no "uncategorised" guests.
    if (eventId == null) { alert('Pick an event for this guest.'); return; }
    if (venueId == null) { alert('Pick a venue.'); return; }
    if (!pax || pax < 1) { alert('At least 1 pax is required.'); return; }
    if (selectedEvent && !eventDateValid) {
      alert('The event date you picked is not a valid occurrence of this event.');
      return;
    }

    const cleanHandle = handle.trim().replace(/^@+/, '');
    if (influencer && !cleanHandle) {
      alert('Influencers must have an Instagram or TikTok handle.');
      return;
    }

    // Resolve chosen slot ids → display names via the venue's timeslot
    // definitions. Denormalising the names onto the guest row keeps
    // chips rendering correctly even if the venue is later edited.
    const timeslotNames = slotIds
      .map((id) => (v?.timeslots || []).find((x) => x.id === id)?.name || '')
      .filter(Boolean);
    const entry = {
      ...(editing?.id != null ? { id: editing.id } : {}),
      name: trimmed,
      venueId,
      eventId: eventId ?? null,
      timeslotIds: [...slotIds],
      timeslotNames,
      pax: Math.max(1, pax ?? 1),
      clubEventId: goingToClub ? (clubEventId ?? null) : null,
      checked: editing?.checked ?? false,
      influencer,
      igHandle: cleanHandle,
      igPlatform: platform,
      createdMonth: editing?.createdMonth ?? today().getMonth(),
      createdAt: editing?.createdAt ?? isoDay(today()),
      eventDate: selectedEvent ? (eventDate || null) : null,
    };

    let saved: Guest;
    try {
      saved = await upsertGuest(entry as Guest | Omit<Guest, 'id'>);
    } catch (err) {
      alert(`Couldn't save guest: ${(err as Error).message}`);
      return;
    }
    void saved; // (retained for future hooks, e.g. analytics)

    // ── Double trigger: send the linked event's description over IG/TT ──
    // Only on creation (not edit), and only if we have a handle + an event
    // with a non-empty description. We confirm so the user keeps full
    // control — promoters often want to review before sending.
    const isCreating = !editing;
    if (isCreating && cleanHandle && eventId != null) {
      const ev = events.find((e) => e.id === eventId);
      const desc = ev?.description?.trim();
      if (desc) {
        const platformLabel = platform === 'tiktok' ? 'TikTok' : 'Instagram';
        const ok = await confirm({
          title: `Send to @${cleanHandle} on ${platformLabel}?`,
          message: `The event description will be copied to your clipboard and ${platformLabel} will open at her profile — just tap the airplane icon and paste.`,
          confirmLabel: 'Send',
        });
        if (ok) {
          await sendViaSocial(platform, cleanHandle, desc);
        }
      }
    }

    onClose();
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]}>
      <IonContent>
        <SheetHeader title={editing ? 'Edit guest' : 'Add guest'} onClose={onClose} />
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Venue</label>
              <SelectField
                value={venueId}
                onChange={(v) => onVenueChange(Number(v))}
                title="Pick a venue"
                options={venues.map((vv) => ({ value: vv.id, label: vv.name }))}
                placeholder="— Select venue —"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Pax</label>
              <NumberField
                className="form-input" min={1}
                value={pax} onChange={setPax}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Select event *</label>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Only events at the selected venue. Sorted by next date —
              the next upcoming one is pre-selected.
            </div>
            {venueEvents.length === 0 ? (
              <div style={{
                fontSize: 12, color: 'var(--color-text-secondary)',
                padding: '10px 12px',
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 'var(--border-radius-sm)',
              }}>
                No events at this venue yet. Create one in the Events tab.
              </div>
            ) : venueEvents.map((e) => {
              const sched = e.isOneTime && e.eventDate
                ? new Date(e.eventDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : (e.weekdays || [e.weekday || '?']).join(', ');
              const cap = eventCapacity(e.id, guests, events);
              const on = eventId === e.id;
              const overflow = cap.capacity > 0 && (pax ?? 0) > cap.left;
              return (
                <div
                  key={e.id}
                  className={`event-picker-item ${on ? 'sel' : ''}`}
                  onClick={() => onPickEvent(e.id)}
                >
                  <div className="event-picker-info">
                    <div className="event-picker-name">{e.name}</div>
                    <div className="event-picker-sub">
                      {sched}{e.isLateClub ? ' · 🌙' : ''}
                      {cap.capacity > 0 && ` · ${cap.used}/${cap.capacity} (${cap.left} left)`}
                    </div>
                    {on && cap.capacity > 0 && overflow && (
                      <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>
                        ⚠︎ {pax} pax exceeds the {cap.left} remaining slots.
                      </div>
                    )}
                  </div>
                  <div className="event-picker-check">{on ? '✓' : ''}</div>
                </div>
              );
            })}
          </div>

          {selectedEvent && !selectedEvent.isOneTime && (
            <div className="form-group">
              <label className="form-label">Event date</label>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Use the arrows to step through this event's scheduled occurrences.
              </div>
              <OccurrencePicker
                event={selectedEvent}
                value={eventDate}
                onChange={setEventDate}
              />
            </div>
          )}

          {selectedEvent?.isOneTime && selectedEvent.eventDate && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '-6px 0 12px' }}>
              Event date: <b>{selectedEvent.eventDate}</b>
            </div>
          )}

          {/* What is she coming to? — chips driven by the EVENT's
              selected timeslots (resolved against the venue). Shows
              the same UX the old "Invitation type(s)" picker did but
              the data now lives on the event, not on the venue. */}
          {selectedEvent && (
            <div className="form-group">
              <label className="form-label">Coming to</label>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Which of the event's timeslots is she attending?
              </div>
              {eventTimeslots.length ? (
                <div className="chip-picker">
                  {eventTimeslots.map((ts) => (
                    <div
                      key={ts.id}
                      className={`chip ${slotIds.includes(ts.id) ? 'sel' : ''}`}
                      onClick={() => toggleSlot(ts.id)}
                    >
                      {ts.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  This event has no timeslots selected. Edit the event to
                  pick one or more from the venue's schedule.
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Social platform {influencer && <span style={{ color: '#A32D2D' }}>*</span>}
            </label>
            <PlatformPicker value={platform} onChange={setPlatform} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                className="form-input"
                placeholder="Handle (without @)"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                style={{ flex: 1 }}
              />
              {handle.trim() && (
                <Avatar
                  name={name || handle}
                  handle={handle}
                  platform={platform}
                  size={40}
                />
              )}
            </div>
            {influencer && !handle.trim() && (
              <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>
                ⚠︎ Influencers must have an Instagram or TikTok handle.
              </div>
            )}
          </div>

          <div className="check-row">
            <input id="gInf" type="checkbox" checked={influencer} onChange={(e) => setInfluencer(e.target.checked)} />
            <label htmlFor="gInf">Influencer (10k+) ★</label>
          </div>

          <div className="check-row">
            <input id="gClub" type="checkbox" checked={goingToClub} onChange={(e) => setGoingToClub(e.target.checked)} />
            <label htmlFor="gClub">Going to club later</label>
          </div>

          {goingToClub && (
            <>
              <div className="info-box" style={{ marginBottom: 8 }}>Only 🌙 Late Club events are shown.</div>
              <div
                className={`event-picker-item none-opt ${clubEventId == null ? 'sel' : ''}`}
                onClick={() => setClubEventId(null)}
              >
                <div className="event-picker-info"><div className="event-picker-name">— No club event</div></div>
                <div className="event-picker-check">{clubEventId == null ? '✓' : ''}</div>
              </div>
              {lateEvents.map((e) => {
                const vv = e.venueId != null ? venueById(e.venueId, venues) : undefined;
                const on = clubEventId === e.id;
                const days = (e.weekdays || [e.weekday || '?']).join(', ');
                return (
                  <div
                    key={e.id}
                    className={`event-picker-item ${on ? 'sel' : ''}`}
                    onClick={() => setClubEventId(e.id)}
                  >
                    <div className="event-picker-info">
                      <div className="event-picker-name">{e.name}</div>
                      <div className="event-picker-sub">{days} · {vv ? vv.name : '?'}</div>
                    </div>
                    <div className="event-picker-check">{on ? '✓' : ''}</div>
                  </div>
                );
              })}
              {!lateEvents.length && (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '6px 0' }}>
                  No late-night club events yet.
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {editing && (
              <button className="btn-danger" onClick={askDelete}>
                Delete
              </button>
            )}
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={save}>
              Save
            </button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};
