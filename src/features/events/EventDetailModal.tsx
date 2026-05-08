import React from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { eventCapacity, venueById, commCalc } from '@/features/summary/calculations';
import { Pill, SlotPill } from '@/components/Pill';
import { initials } from '@/core/utils/format';
import { StarBadge, SocialBadge } from '@/components/SocialBadge';
import { CapacityBar } from '@/components/CapacityBar';
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
  if (!e) {
    return <IonModal isOpen={open} onDidDismiss={onClose}><IonContent /></IonModal>;
  }
  const v = e.venueId != null ? venueById(e.venueId, venues) : undefined;
  const evG = guests.filter((g) => g.eventId === e.id);
  const evR = reservations.filter((r) => r.eventId === e.id);
  const ids = e.selectedSlotIds || [];
  const cap = eventCapacity(e.id, guests, events);

  const dateLabel = e.isOneTime && e.eventDate
    ? new Date(e.eventDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : (e.weekdays || [e.weekday || '?']).filter(Boolean).join(', ');

  return (
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]}>
      <IonContent>
        <SheetHeader
          title={e.name}
          onClose={onClose}
          rightExtras={<button className="btn-ghost" onClick={() => onEdit(e.id)}>Edit</button>}
        />
        <div style={{ padding: '16px 16px 32px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <Pill tone="gray">{dateLabel}</Pill>
            {ids.map((id) => <SlotPill key={id} slotId={id} />)}
            {v && <Pill tone="gray">{v.name}</Pill>}
            {e.isOneTime && <Pill tone="blue">One-time</Pill>}
            {e.isPrivate && <Pill tone="pink">Private</Pill>}
            {e.isLateClub && <Pill tone="purple">🌙 Late Club</Pill>}
          </div>

          {/* ── Capacity ─────────────────────────────────── */}
          {cap.capacity > 0 ? (
            <div className="summary-block" style={{ margin: '0 0 14px' }}>
              <div className="summary-head">Capacity</div>
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
              {evG.reduce((a, g) => a + g.pax, 0)} guests · no capacity set
            </div>
          )}

          {e.description && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              {e.description}
            </p>
          )}

          {/* ── Guests linked to this event ───────────────── */}
          <SectionHead>Guests ({evG.reduce((a, g) => a + g.pax, 0)} pax)</SectionHead>
          {evG.length ? (
            <div className="list-card" style={{ margin: '0 0 14px' }}>
              {evG.map((g) => (
                <div key={g.id} className="list-row" style={{ cursor: 'default' }}>
                  <div className="list-avatar">{initials(g.name)}</div>
                  <div className="list-main">
                    <div className="list-name"><StarBadge on={g.influencer} /><span>{g.name}</span></div>
                    <div className="list-sub">{(g.inviteTypeNames || []).join(', ')} · {g.pax} pax</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>No guests linked.</p>
          )}

          {/* ── Reservations linked to this event ─────────── */}
          <SectionHead>Reservations ({evR.length})</SectionHead>
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
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>No reservations linked.</p>
          )}

          {/* ── Private party invite list ─────────────────── */}
          {e.isPrivate && (
            <>
              <SectionHead>Invite to private party</SectionHead>
              <div className="list-card" style={{ margin: '0 0 14px' }}>
                {guests.length ? guests.map((g) => {
                  const inv = (e.invitedGuests || []).includes(g.name);
                  return (
                    <div key={g.id} className="list-row" onClick={() => togglePrivateInvite(e.id, g.name)}>
                      <div className="list-avatar">{initials(g.name)}</div>
                      <div className="list-main">
                        <div className="list-name"><StarBadge on={g.influencer} /><span>{g.name}</span></div>
                      </div>
                      {inv && <Pill tone="teal">Invited</Pill>}
                    </div>
                  );
                }) : (
                  <div style={{ padding: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>No guests yet.</div>
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
