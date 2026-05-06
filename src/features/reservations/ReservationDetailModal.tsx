import React from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { initials } from '@/core/utils/format';
import { commCalc, slotLabel, venueName, netToYou } from '@/features/summary/calculations';
import { SocialBadge } from '@/components/SocialBadge';

interface Props {
  open: boolean;
  onClose: () => void;
  reservationId: number | null;
  onEdit: (id: number) => void;
}

export const ReservationDetailModal: React.FC<Props> = ({ open, onClose, reservationId, onEdit }) => {
  const { reservations, venues, removeReservation } = useAppStore((s) => ({
    reservations: s.reservations, venues: s.venues, removeReservation: s.removeReservation,
  }));
  const r = reservationId != null ? reservations.find((x) => x.id === reservationId) : null;
  if (!r) return <IonModal isOpen={open} onDidDismiss={onClose}><IonContent /></IonModal>;
  const c = commCalc(r, venues);

  return (
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]}>
      <IonContent>
        <div style={{
          padding: '14px 16px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--color-background-primary)', zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="list-avatar" style={{ background: '#EAF3DE', color: '#3B6D11', width: 42, height: 42, fontSize: 15 }}>
              {initials(r.name)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {r.phoneCode || ''} {r.phoneNum || 'No phone'}
              </div>
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="detail-kv"><span className="dk">Venue</span><span className="dv">{venueName(r.venueId, venues)}</span></div>
          <div className="detail-kv"><span className="dk">VIP type</span><span className="dv">{r.vipType} · €{c.price}/table</span></div>
          <div className="detail-kv"><span className="dk">Timeslot</span><span className="dv">{slotLabel(r.slotId, venues)}</span></div>
          <div className="detail-kv"><span className="dk">Pax</span><span className="dv">{r.pax}</span></div>
          <div className="detail-kv"><span className="dk">Table total</span><span className="dv">€{c.tableTotal}</span></div>
          <div className="detail-kv">
            <span className="dk">Your commission ({r.commissionPct}%)</span>
            <span className="dv" style={{ color: '#3B6D11' }}>€{c.promoter}</span>
          </div>
          {r.fromInvite && (
            <>
              <div className="detail-kv">
                <span className="dk">Via invitation</span>
                <span className="dv">
                  {r.commissionEarner} <SocialBadge handle={r.inviterHandle} platform={r.inviterPlatform} />
                </span>
              </div>
              <div className="detail-kv">
                <span className="dk">Their cut ({r.womanPct}%)</span>
                <span className="dv" style={{ color: '#F97316' }}>€{c.woman}</span>
              </div>
              <div className="detail-kv">
                <span className="dk">Net to you</span>
                <span className="dv" style={{ color: '#3B6D11' }}>€{netToYou(c)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button className="btn-secondary" onClick={() => { removeReservation(r.id); onClose(); }}>Delete</button>
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={() => onEdit(r.id)}>Edit</button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

