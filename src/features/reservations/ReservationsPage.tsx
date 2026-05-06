import React from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { initials } from '@/core/utils/format';
import { commCalc, venueName } from '@/features/summary/calculations';
import { SocialBadge } from '@/components/SocialBadge';
import { EmptyBox } from '@/components/EmptyBox';

export const ReservationsPage: React.FC = () => {
  const { reservations, venues } = useAppStore((s) => ({
    reservations: s.reservations, venues: s.venues,
  }));
  const open = useUIStore((s) => s.open);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="page-title">Reservations</div>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => open('addRes')}
              >+ Add</button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {reservations.length ? (
          <div className="list-card">
            {reservations.map((r) => {
              const c = commCalc(r, venues);
              return (
                <div key={r.id} className="list-row" onClick={() => open('resDetail', { id: r.id })}>
                  <div className="list-avatar" style={{ background: '#EAF3DE', color: '#3B6D11' }}>
                    {initials(r.name)}
                  </div>
                  <div className="list-main">
                    <div className="list-name">
                      <span>{r.name}</span>
                      {r.fromInvite && <SocialBadge handle={r.inviterHandle} platform={r.inviterPlatform} />}
                    </div>
                    <div className="list-sub">
                      {venueName(r.venueId, venues)} · {r.vipType || '—'}
                      {c.price ? ` (€${c.price} table)` : ''} · {r.pax} pax
                    </div>
                  </div>
                  <div className="list-right">
                    <div className="list-right-val" style={{ color: '#3B6D11', fontSize: 12 }}>
                      +€{c.promoter}
                    </div>
                    <div className="list-right-sub">
                      {r.fromInvite ? <span style={{ color: '#F97316' }}>Via invitation</span> : 'Direct'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyBox>
            No reservations yet.<br />
            Tap <b>+ Add</b> to log a VIP table.
          </EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
