import React, { useEffect, useRef, useState } from 'react';
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
  const { guests, venues, toggleArrived, toggleCancelled } = useAppStore((s) => ({
    guests: s.guests, venues: s.venues,
    toggleArrived: s.toggleArrived, toggleCancelled: s.toggleCancelled,
  }));
  const open = useUIStore((s) => s.open);
  const [activeVenue, setActiveVenue] = useState<'all' | number>('all');

  const filtered = activeVenue === 'all' ? guests : guests.filter((g) => g.venueId === activeVenue);

  // Hint animation: when the list mounts, the first row briefly opens
  // its right options (revealing "Cancel") then its left ("Arrived"),
  // so users discover the swipe affordance. Once per session, only on
  // the first guest in the list. Uses IonItemSliding's open/close API
  // since the actual translation is owned by the Ionic gesture engine.
  const firstRowRef = useRef<HTMLIonItemSlidingElement | null>(null);
  const peekedRef = useRef(false);
  useEffect(() => {
    if (peekedRef.current || !filtered.length) return;
    const el = firstRowRef.current;
    if (!el) return;
    peekedRef.current = true;
    let cancelled = false;
    const peek = async () => {
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      try {
        await el.open('end');
        await new Promise((r) => setTimeout(r, 700));
        if (cancelled) return;
        await el.close();
        await new Promise((r) => setTimeout(r, 200));
        if (cancelled) return;
        await el.open('start');
        await new Promise((r) => setTimeout(r, 700));
        if (cancelled) return;
        await el.close();
      } catch { /* IonItemSliding may not be ready */ }
    };
    peek();
    return () => { cancelled = true; };
  }, [filtered.length]);

  const askCancel = (id: number, name: string) => {
    if (window.confirm(`Cancel invitation for ${name}?`)) toggleCancelled(id);
  };

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
              ← swipe to mark arrived &nbsp;·&nbsp; swipe → to cancel
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {filtered.length ? (
          <IonList lines="none" style={{ background: 'transparent', padding: '0 16px' }}>
            {filtered.map((g, i) => {
              const isArrived = g.checked;
              const isCancelled = !!g.cancelled;
              const rowState = isArrived ? 'arrived' : isCancelled ? 'cancelled' : 'pending';
              return (
                <IonItemSliding
                  key={g.id}
                  ref={i === 0 ? firstRowRef : undefined}
                  className={`guest-sliding-item state-${rowState}`}
                >
                  {/* Left side: arrived */}
                  <IonItemOptions side="start" onIonSwipe={() => toggleArrived(g.id)}>
                    <IonItemOption
                      expandable
                      color={isArrived ? 'medium' : 'primary'}
                      onClick={(ev) => {
                        toggleArrived(g.id);
                        const ion = ev.currentTarget.closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
                        ion?.close();
                      }}
                    >
                      {isArrived ? 'Mark pending' : '✓ Arrived'}
                    </IonItemOption>
                  </IonItemOptions>

                  <IonItem
                    button detail={false}
                    onClick={() => open('guestDetail', { id: g.id })}
                    className="guest-row"
                    lines="none"
                  >
                    <div className="list-row" style={{ flex: 1, padding: '8px 4px', borderBottom: 'none' }}>
                      <span className={`status-dot status-dot--${rowState}`} />
                      <Avatar name={g.name} handle={g.igHandle} platform={g.igPlatform} />
                      <div className="list-main">
                        <div className="list-name">
                          <StarBadge on={g.influencer} />
                          <span style={{ textDecoration: isCancelled ? 'line-through' : undefined }}>
                            {g.name}
                          </span>
                          <SocialBadge handle={g.igHandle} platform={g.igPlatform} />
                        </div>
                        <div className="list-sub">
                          {venueName(g.venueId, venues)} · {(g.inviteTypeNames || []).join(', ') || 'No type'} · {g.pax} pax
                        </div>
                      </div>
                      <div className="list-right">
                        <div className={`list-right-sub state-label state-label--${rowState}`}>
                          {isArrived ? 'Arrived' : isCancelled ? 'Cancelled' : 'Pending'}
                        </div>
                        {g.clubEventId && (
                          <Pill tone="purple" style={{ fontSize: 10, marginTop: 3, display: 'inline-block' }}>
                            🌙 Club
                          </Pill>
                        )}
                      </div>
                    </div>
                  </IonItem>

                  {/* Right side: cancel (with confirmation prompt) */}
                  <IonItemOptions
                    side="end"
                    onIonSwipe={() => askCancel(g.id, g.name)}
                  >
                    <IonItemOption
                      expandable
                      color={isCancelled ? 'medium' : 'danger'}
                      onClick={(ev) => {
                        askCancel(g.id, g.name);
                        const ion = ev.currentTarget.closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
                        ion?.close();
                      }}
                    >
                      {isCancelled ? 'Restore' : '✕ Cancel'}
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              );
            })}
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
