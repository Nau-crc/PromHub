import React, { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { initials } from '@/core/utils/format';
import { venueName } from '@/features/summary/calculations';
import { StarBadge, SocialBadge } from '@/components/SocialBadge';
import { Pill } from '@/components/Pill';
import { EmptyBox } from '@/components/EmptyBox';

export const GuestsPage: React.FC = () => {
  const { guests, venues } = useAppStore((s) => ({ guests: s.guests, venues: s.venues }));
  const open = useUIStore((s) => s.open);
  const [activeVenue, setActiveVenue] = useState<'all' | number>('all');

  const filtered = activeVenue === 'all' ? guests : guests.filter((g) => g.venueId === activeVenue);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="page-title">Guest list</div>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => open('addGuest')}
              >+ Add</button>
            </div>
            <div style={{ overflowX: 'auto', display: 'flex', gap: 6, marginTop: 10, paddingBottom: 10 }}>
              <button className={`tog-btn ${activeVenue === 'all' ? 'on' : ''}`} onClick={() => setActiveVenue('all')}>All</button>
              {venues.map((v) => (
                <button
                  key={v.id}
                  className={`tog-btn ${activeVenue === v.id ? 'on' : ''}`}
                  onClick={() => setActiveVenue(v.id)}
                >{v.name}</button>
              ))}
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {filtered.length ? (
          <div className="list-card">
            {filtered.map((g) => (
              <div key={g.id} className="list-row" onClick={() => open('guestDetail', { id: g.id })}>
                <div className={g.checked ? 'arrived-dot' : 'pending-dot'} />
                <div className="list-avatar">{initials(g.name)}</div>
                <div className="list-main">
                  <div className="list-name">
                    <StarBadge on={g.influencer} />
                    <span>{g.name}</span>
                    <SocialBadge handle={g.igHandle} platform={g.igPlatform} />
                  </div>
                  <div className="list-sub">
                    {venueName(g.venueId, venues)} · {(g.inviteTypeNames || []).join(', ') || 'No type'} · {g.pax} pax
                  </div>
                </div>
                <div className="list-right">
                  <div className="list-right-sub" style={{ color: g.checked ? '#0F6E56' : undefined }}>
                    {g.checked ? 'Arrived' : 'Pending'}
                  </div>
                  {g.clubEventId && (
                    <Pill tone="purple" style={{ fontSize: 10, marginTop: 3, display: 'inline-block' }}>
                      🌙 Club
                    </Pill>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBox>
            No guests yet.<br />
            Tap <b>+ Add</b> to add your first guest.
          </EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
