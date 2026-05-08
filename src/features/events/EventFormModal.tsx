import React, { useEffect, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import type { PromEvent } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { isoDay, todayWeekday } from '@/core/utils/date';
import { today } from '@/core/constants';
import { DayChips } from '@/components/DayChips';
import { SlotChips } from '@/components/SlotChips';
import { SheetHeader } from '@/components/SheetHeader';
import { NumberField } from '@/components/NumberField';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: PromEvent | null;
  onRequestNewVenue?: () => void;
}

const NO_VENUE = '__none__';
const NEW_VENUE = '__new__';

export const EventFormModal: React.FC<Props> = ({ open, onClose, editing, onRequestNewVenue }) => {
  const { venues, upsertEvent, removeEvent, nextId } = useAppStore((s) => ({
    venues: s.venues,
    upsertEvent: s.upsertEvent,
    removeEvent: s.removeEvent,
    nextId: s.nextId,
  }));

  const [name, setName] = useState('');
  const [venueId, setVenueId] = useState<number | null>(null);
  const [isOneTime, setIsOneTime] = useState(false);
  const [eventDate, setEventDate] = useState<string>('');
  const [days, setDays] = useState<string[]>([]);
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [desc, setDesc] = useState('');
  const [isPriv, setPriv] = useState(false);
  const [isLate, setLate] = useState(false);
  const [capacity, setCapacity] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setVenueId(editing?.venueId ?? venues[0]?.id ?? null);
    setIsOneTime(!!editing?.isOneTime);
    setEventDate(editing?.eventDate ?? isoDay(today()));
    setDays(editing && !editing.isOneTime
      ? (editing.weekdays || [editing.weekday]).filter(Boolean)
      : [todayWeekday()]);
    const initV = venues.find((v) => v.id === (editing?.venueId ?? venues[0]?.id));
    setSlotIds(
      editing
        ? [...(editing.selectedSlotIds || [])]
        : initV?.timeslots?.length ? [initV.timeslots[0].id] : [],
    );
    setDesc(editing?.description ?? '');
    setPriv(!!editing?.isPrivate);
    setLate(!!editing?.isLateClub);
    setCapacity(editing?.capacity ?? null);
  }, [open, editing, venues]);

  const onVenueChange = (val: string) => {
    if (val === NEW_VENUE) {
      onRequestNewVenue?.();
      return;
    }
    if (val === NO_VENUE || val === '') {
      setVenueId(null);
      setSlotIds([]); // no venue → no timeslots
      return;
    }
    const id = parseInt(val);
    setVenueId(id);
    const v = venues.find((x) => x.id === id);
    setSlotIds(v?.timeslots?.length ? [v.timeslots[0].id] : []);
  };

  const toggleDay = (d: string) =>
    setDays((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]));

  const toggleSlot = (id: string) =>
    setSlotIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (isOneTime) {
      if (!eventDate) { alert('Pick a date.'); return; }
    } else {
      if (!days.length) { alert('Select at least one day.'); return; }
    }

    // Timeslots only required when a venue is set (otherwise the event has none)
    if (venueId != null && !slotIds.length) {
      alert('Pick at least one timeslot, or remove the venue.');
      return;
    }

    const entry: PromEvent = {
      id: editing?.id ?? (nextId('event') as number),
      name: trimmed,
      venueId,
      weekdays: isOneTime ? [] : [...days],
      weekday: isOneTime ? '' : days[0],
      selectedSlotIds: venueId != null ? [...slotIds] : [],
      description: desc.trim(),
      videoUrl: '',
      isPrivate: isPriv,
      isLateClub: isLate,
      invitedGuests: editing?.invitedGuests ?? [],
      isOneTime,
      eventDate: isOneTime ? eventDate : null,
      capacity: capacity && capacity > 0 ? capacity : null,
    };
    upsertEvent(entry);
    onClose();
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]}>
      <IonContent>
        <SheetHeader title={editing ? 'Edit event' : 'New event'} onClose={onClose} />
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="form-group">
            <label className="form-label">Event name</label>
            <input className="form-input" placeholder="e.g. The Sailor" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Venue (optional)</label>
            <select className="form-select" value={venueId ?? NO_VENUE} onChange={(e) => onVenueChange(e.target.value)}>
              <option value={NO_VENUE}>— No venue —</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value={NEW_VENUE}>+ Add new venue…</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Schedule</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button type="button" className={`tog-btn ${!isOneTime ? 'on' : ''}`} onClick={() => setIsOneTime(false)}>
                Recurring
              </button>
              <button type="button" className={`tog-btn ${isOneTime ? 'on' : ''}`} onClick={() => setIsOneTime(true)}>
                One-time
              </button>
            </div>

            {isOneTime ? (
              <input
                className="form-input"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            ) : (
              <DayChips selected={days} onToggle={toggleDay} />
            )}
          </div>

          {venueId != null && (
            <div className="form-group">
              <label className="form-label">Timeslots for this event</label>
              <SlotChips venueId={venueId} selected={slotIds} onToggle={toggleSlot} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Capacity (max guests, optional)</label>
            <NumberField
              className="form-input"
              placeholder="e.g. 20"
              min={0}
              value={capacity}
              onChange={setCapacity}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="check-row">
            <input id="evPrivate" type="checkbox" checked={isPriv} onChange={(e) => setPriv(e.target.checked)} />
            <label htmlFor="evPrivate">Private event</label>
          </div>
          <div className="check-row">
            <input id="evLate" type="checkbox" checked={isLate} onChange={(e) => setLate(e.target.checked)} />
            <label htmlFor="evLate">🌙 Late-night club event</label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {editing && (
              <button className="btn-danger" onClick={() => { removeEvent(editing.id); onClose(); }}>
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
