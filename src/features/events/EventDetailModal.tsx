import React, { useEffect, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import {
  eventCapacity, venueById, commCalc,
  occurs, nextOccurrence, previousOccurrence, eventScheduleLabel,
} from '@/features/summary/calculations';
import { Pill, SlotPill } from '@/components/Pill';
import { Avatar } from '@/components/Avatar';
import { initials } from '@/core/utils/format';
import { isoDay } from '@/core/utils/date';
import { today } from '@/core/constants';
import { StarBadge, SocialBadge } from '@/components/SocialBadge';
import { CapacityBar } from '@/components/CapacityBar';
import { CopyButton } from '@/components/CopyButton';
import { SheetHeader } from '@/components/SheetHeader';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: number | null;
  onEdit: (id: number) => void;
  onAddGuest: (eventId: number) => void;
  onAddRes: (eventId: number) => void;
}

export const EventDetailModal: React.FC<Props> = ({ open, onClose, eventId, onEdit, onAddGuest, onAddRes }) => {
  const { events, venues, guests, reservations, togglePrivateInvite } = useAppStore((s) => ({
    events: s.events,
    venues: s.venues,
    guests: s.guests,
    reservations: s.reservations,
    togglePrivateInvite: s.togglePrivateInvite,
  }));
  const e = eventId != null ? events.find((x) => x.id === eventId) : null;

  // ── Per-occurrence date selector ─────────────────────────
  // For one-time events the date is fixed to event.eventDate.
  // For recurring events we default to today if it's an occurrence,
  // otherwise the next upcoming occurrence (fallback: most recent).
  const todayKey = isoDay(today());
  const [selectedDate, setSelectedDate] = useState<string>('');
  useEffect(() => {
    if (!open || !e) return;
    if (e.isOneTime) {
      setSelectedDate(e.eventDate ?? '');
      return;
    }
    if (occurs(e, todayKey)) setSelectedDate(todayKey);
    else setSelectedDate(nextOccurrence(e, todayKey) ?? previousOccurrence(e, todayKey) ?? '');
  }, [open, e, todayKey]);

  if (!e) {
    return <IonModal isOpen={open} onDidDismiss={onClose}><IonContent /></IonModal>;
  }

  const v = e.venueId != null ? venueById(e.venueId, venues) : undefined;

  // STRICT per-date filtering. Guests/reservations show only for the selected
  // occurrence. Plain filters (no useMemo) — must not introduce conditional
  // hooks after the `if (!e)` early return above.
  const evG = guests.filter((g) => g.eventId === e.id && g.eventDate === selectedDate);
  const evR = reservations.filter((r) => r.eventId === e.id && r.eventDate === selectedDate);

  const ids = e.selectedSlotIds || [];
  const cap = eventCapacity(e.id, guests, events, selectedDate);

  const occurrenceLabel = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : '—';

  const scheduleLabel = eventScheduleLabel(e);

  // Step the recurring date selector by one occurrence
  const stepDate = (direction: -1 | 1) => {
    if (e.isOneTime || !selectedDate) return;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const seed = new Date(y, m - 1, d + direction);
    const seedIso = isoDay(seed);
    const next = direction === 1
      ? nextOccurrence(e, seedIso)
      : previousOccurrence(e, seedIso);
    if (next) setSelectedDate(next);
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]}>
      <IonContent>
        <SheetHeader
          title={e.name}
          onClose={onClose}
          rightExtras={<button className="btn-ghost" onClick={() => onEdit(e.id)}>Edit</button>}
        />
        <div style={{ padding: '16px 16px 32px' }}>
          {/* Pills row: schedule, slots, venue, flags */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <Pill tone="gray">{scheduleLabel}</Pill>
            {ids.map((id) => <SlotPill key={id} slotId={id} />)}
            {v && <Pill tone="gray">{v.name}</Pill>}
            {e.isOneTime && <Pill tone="blue">One-time</Pill>}
            {e.isPrivate && <Pill tone="pink">Private</Pill>}
            {e.isLateClub && <Pill tone="purple">🌙 Late Club</Pill>}
          </div>

          {/* ── Date picker for recurring events ──────────────── */}
          {!e.isOneTime && (
            <div className="summary-block" style={{ margin: '0 0 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                <button
                  type="button" className="cal-nav-btn"
                  onClick={() => stepDate(-1)}
                  disabled={!selectedDate}
                >‹</button>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Occurrence
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {occurrenceLabel}
                  </div>
                </div>
                <button
                  type="button" className="cal-nav-btn"
                  onClick={() => stepDate(1)}
                  disabled={!selectedDate}
                >›</button>
              </div>
              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', padding: '8px 12px' }}>
                <input
                  type="date"
                  className="form-input"
                  value={selectedDate}
                  min={e.seasonStart ?? undefined}
                  max={e.seasonEnd ?? undefined}
                  onChange={(ev) => setSelectedDate(ev.target.value)}
                  style={{ fontSize: 13, padding: '8px 10px' }}
                />
                {selectedDate && !occurs(e, selectedDate) && (
                  <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>
                    ⚠︎ Not a scheduled occurrence (will show empty lists).
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Capacity for this occurrence ──────────────────── */}
          {cap.capacity > 0 ? (
            <div className="summary-block" style={{ margin: '0 0 14px' }}>
              <div className="summary-head">Capacity for {occurrenceLabel}</div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {cap.used} / {cap.capacity} guests
                  </span>
                  <span style={{ fontSize: 12, color: cap.fillClass === 'full' ? '#A32D2D' : 'var(--color-text-secondary)' }}>
                    {cap.left} left
                  </span>
                </div>
                <CapacityBar pct={cap.pct} warnAt={75} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              {evG.reduce((a, g) => a + g.pax, 0)} guests on this date · no capacity set
            </div>
          )}

          {/* ── Description with copy button ──────────────────── */}
          {e.description && (
            <div style={{
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-md)',
              padding: '10px 12px',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '.04em',
                }}>Description</span>
                <CopyButton text={e.description} />
              </div>
              <p style={{
                fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              }}>{e.description}</p>
            </div>
          )}

          {/* ── Guests for this occurrence ─────────────────────── */}
          <SectionHead>Guests on {occurrenceLabel} ({evG.reduce((a, g) => a + g.pax, 0)} pax)</SectionHead>
          {evG.length ? (
            <div className="list-card" style={{ margin: '0 0 14px' }}>
              {evG.map((g) => (
                <div key={g.id} className="list-row" style={{ cursor: 'default' }}>
                  <Avatar name={g.name} handle={g.igHandle} platform={g.igPlatform} />
                  <div className="list-main">
                    <div className="list-name"><StarBadge on={g.influencer} /><span>{g.name}</span></div>
                    <div className="list-sub">{(g.inviteTypeNames || []).join(', ')} · {g.pax} pax</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              No guests on this date.
            </p>
          )}

          {/* ── Reservations for this occurrence ───────────────── */}
          <SectionHead>Reservations on {occurrenceLabel} ({evR.length})</SectionHead>
          {evR.length ? (
            <div className="list-card" style={{ margin: '0 0 14px' }}>
              {evR.map((r) => {
                const c = commCalc(r, venues);
                return (
                  <div key={r.id} className="list-row" style={{ cursor: 'default' }}>
                    <div className="list-avatar" style={{ background: '#EAF3DE', color: '#3B6D11' }}>
                      {initials(r.name)}
                    </div>
                    <div className="list-main">
                      <div className="list-name">
                        <span>{r.name}</span>
                        {r.fromInvite && <SocialBadge handle={r.inviterHandle} platform={r.inviterPlatform} />}
                      </div>
                      <div className="list-sub">
                        {r.vipType || '—'}{c.price ? ` (€${c.price})` : ''} · {r.pax} pax
                      </div>
                    </div>
                    <div className="list-right">
                      <div className="list-right-val" style={{ color: '#3B6D11', fontSize: 12 }}>+€{c.promoter}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              No reservations on this date.
            </p>
          )}

          {/* ── Private party invite list ──────────────────────── */}
          {e.isPrivate && (
            <>
              <SectionHead>Invite to private party</SectionHead>
              <div className="list-card" style={{ margin: '0 0 14px' }}>
                {guests.length ? guests.map((g) => {
                  const inv = (e.invitedGuests || []).includes(g.name);
                  return (
                    <div key={g.id} className="list-row" onClick={() => togglePrivateInvite(e.id, g.name)}>
                      <Avatar name={g.name} handle={g.igHandle} platform={g.igPlatform} />
                      <div className="list-main">
                        <div className="list-name"><StarBadge on={g.influencer} /><span>{g.name}</span></div>
                      </div>
                      {inv && <Pill tone="teal">Invited</Pill>}
                    </div>
                  );
                }) : (
                  <div style={{ padding: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    No guests yet.
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onAddGuest(e.id)}>+ Guest</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => onAddRes(e.id)}>+ Reservation</button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

const SectionHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8,
  }}>{children}</div>
);
