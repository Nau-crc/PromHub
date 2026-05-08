import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton,
  IonList, IonItem, IonItemSliding, IonItemOptions, IonItemOption,
} from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { venueName } from '@/features/summary/calculations';
import { StarBadge, SocialBadge } from '@/components/SocialBadge';
import { Avatar } from '@/components/Avatar';
import { Pill } from '@/components/Pill';
import { EmptyBox } from '@/components/EmptyBox';

export const GuestsPage: React.FC = () => {
  const { guests, venues, toggleArrived } = useAppStore((s) => ({
    guests: s.guests, venues: s.venues, toggleArrived: s.toggleArrived,
  }));
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
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', paddingBottom: 6 }}>
              ← Swipe a guest to mark arrived/pending
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {filtered.length ? (
          <IonList lines="none" style={{ background: 'transparent', padding: '0 16px' }}>
            {filtered.map((g) => (
              <IonItemSliding key={g.id} className="guest-sliding-item">
                <IonItem
                  button
                  detail={false}
                  onClick={() => open('guestDetail', { id: g.id })}
                  className="guest-row"
                  lines="none"
                >
                  <div className="list-row" style={{ flex: 1, padding: '8px 4px', borderBottom: 'none' }}>
                    <div className={g.checked ? 'arrived-dot' : 'pending-dot'} />
                    <Avatar name={g.name} handle={g.igHandle} platform={g.igPlatform} />
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
                </IonItem>
                <IonItemOptions side="start" onIonSwipe={() => toggleArrived(g.id)}>
                  <IonItemOption
                    expandable
                    color={g.checked ? 'medium' : 'success'}
                    onClick={(ev) => {
                      toggleArrived(g.id);
                      // Close the sliding state after toggling
                      const ion = (ev.currentTarget.closest('ion-item-sliding') as HTMLIonItemSlidingElement | null);
                      ion?.close();
                    }}
                  >
                    {g.checked ? 'Mark pending' : '✓ Arrived'}
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
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
