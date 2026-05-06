import React from 'react';
import { IonModal, IonContent } from '@ionic/react';
import type { PromEvent } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { venueById } from '@/features/summary/calculations';
import { Pill, SlotPill } from '@/components/Pill';
import { initials } from '@/core/utils/format';
import { StarBadge } from '@/components/SocialBadge';
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
  const { events, venues, guests, togglePrivateInvite } = useAppStore((s) => ({
    events: s.events, venues: s.venues, guests: s.guests, togglePrivateInvite: s.togglePrivateInvite,
  }));
  const e = eventId != null ? events.find((x) => x.id === eventId) : null;
  if (!e) {
    return <IonModal isOpen={open} onDidDismiss={onClose}><IonContent /></IonModal>;
  }
  const v = venueById(e.venueId, venues);
  const evG = guests.filter((g) => g.eventId === e.id);
  const ids = e.selectedSlotIds || [];
  const days = (e.weekdays || [e.weekday || '?']).filter(Boolean).join(', ');

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
            <Pill tone="gray">{days}</Pill>
            {ids.map((id) => <SlotPill key={id} slotId={id} />)}
            <Pill tone="gray">{v ? v.name : '?'}</Pill>
            {e.isPrivate && <Pill tone="pink">Private</Pill>}
            {e.isLateClub && <Pill tone="purple">🌙 Late Club</Pill>}
          </div>
          {e.description && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              {e.description}
            </p>
          )}
          <div style={{
            fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)',
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8,
          }}>
            Guests ({evG.reduce((a, g) => a + g.pax, 0)} pax)
          </div>
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
          {e.isPrivate && (
            <>
              <div style={{
                fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)',
                textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8,
              }}>
                Invite to private party
              </div>
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
