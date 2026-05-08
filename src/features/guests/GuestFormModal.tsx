import React, { useEffect, useMemo, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import type { Guest, Platform, PromEvent } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { today } from '@/core/constants';
import { isoDay } from '@/core/utils/date';
import { eventCapacity, lateClubEvents, venueById } from '@/features/summary/calculations';
import { SheetHeader } from '@/components/SheetHeader';
import { PlatformPicker } from '@/components/PlatformPicker';
import { NumberField } from '@/components/NumberField';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Guest | null;
  /** Pre-seed event when launched from event detail */
  seedEventId?: number;
}

export const GuestFormModal: React.FC<Props> = ({ open, onClose, editing, seedEventId }) => {
  const { venues, events, guests, upsertGuest, removeGuest, nextId } = useAppStore((s) => ({
    venues: s.venues, events: s.events, guests: s.guests,
    upsertGuest: s.upsertGuest, removeGuest: s.removeGuest, nextId: s.nextId,
  }));

  const [name, setName] = useState('');
  const [venueId, setVenueId] = useState<number | null>(null);
  const [pax, setPax] = useState<number | null>(1);
  const [invTypeIds, setInvTypeIds] = useState<string[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [handle, setHandle] = useState('');
  const [influencer, setInfluencer] = useState(false);
  const [goingToClub, setGoingToClub] = useState(false);
  const [clubEventId, setClubEventId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setVenueId(editing?.venueId ?? venues[0]?.id ?? null);
    setPax(editing?.pax ?? 1);
    setInvTypeIds(editing ? [...(editing.inviteTypeIds || [])] : []);
    setEventId(editing ? editing.eventId : (seedEventId ?? null));
    setPlatform(editing?.igPlatform ?? 'instagram');
    setHandle(editing?.igHandle ?? '');
    setInfluencer(!!editing?.influencer);
    setGoingToClub(!!editing?.clubEventId);
    setClubEventId(editing?.clubEventId ?? null);
  }, [open, editing, seedEventId, venues]);

  const v = useMemo(() => (venueId != null ? venueById(venueId, venues) : undefined), [venueId, venues]);
  const invTypes = v?.inviteTypes || [];
  const lateEvents: PromEvent[] = useMemo(() => lateClubEvents(events), [events]);

  const onVenueChange = (id: number) => {
    setVenueId(id);
    setInvTypeIds([]); // reset like MVP
  };

  const toggleInvType = (id: string) =>
    setInvTypeIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) { alert('Please enter a name.'); return; }
    if (venueId == null) { alert('Form error. Please try again.'); return; }

    const inviteTypeNames = invTypeIds
      .map((id) => (v?.inviteTypes || []).find((x) => x.id === id)?.name || '')
      .filter(Boolean);

    const entry: Guest = {
      id: editing?.id ?? (nextId('guest') as number),
      name: trimmed,
      venueId,
      eventId: eventId ?? null,
      inviteTypeIds: [...invTypeIds],
      inviteTypeNames,
      pax: Math.max(1, pax ?? 1),
      clubEventId: goingToClub ? (clubEventId ?? null) : null,
      checked: editing?.checked ?? false,
      influencer,
      igHandle: handle.trim(),
      igPlatform: platform,
      createdMonth: editing?.createdMonth ?? today().getMonth(),
      createdAt: editing?.createdAt ?? isoDay(today()),
    };

    upsertGuest(entry);
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
              <select className="form-select" value={venueId ?? ''} onChange={(e) => onVenueChange(parseInt(e.target.value))}>
                {venues.map((vv) => <option key={vv.id} value={vv.id}>{vv.name}</option>)}
              </select>
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
            <label className="form-label">Invitation type(s)</label>
            {invTypes.length ? (
              <div className="chip-picker">
                {invTypes.map((t) => (
                  <div
                    key={t.id}
                    className={`chip ${invTypeIds.includes(t.id) ? 'sel' : ''}`}
                    onClick={() => toggleInvType(t.id)}
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                No invitation types set for this venue. Add them in Venues.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Select event</label>
            <div
              className={`event-picker-item none-opt ${eventId == null ? 'sel' : ''}`}
              onClick={() => setEventId(null)}
            >
              <div className="event-picker-info"><div className="event-picker-name">— No event</div></div>
              <div className="event-picker-check">{eventId == null ? '✓' : ''}</div>
            </div>
            {events.map((e) => {
              const vv = e.venueId != null ? venueById(e.venueId, venues) : undefined;
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
                  onClick={() => setEventId(e.id)}
                >
                  <div className="event-picker-info">
                    <div className="event-picker-name">{e.name}</div>
                    <div className="event-picker-sub">
                      {sched} · {vv ? vv.name : 'No venue'}{e.isLateClub ? ' 🌙' : ''}
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

          <div className="form-group">
            <label className="form-label">Social platform</label>
            <PlatformPicker value={platform} onChange={setPlatform} />
            <input className="form-input" placeholder="Handle (without @)" value={handle} onChange={(e) => setHandle(e.target.value)} />
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
              <button className="btn-danger" onClick={() => { removeGuest(editing.id); onClose(); }}>
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
