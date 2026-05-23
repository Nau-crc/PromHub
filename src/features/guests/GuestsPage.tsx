import React, { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton,
  IonList, IonItem, IonItemSliding, IonItemOptions, IonItemOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { useConfirm } from '@/store/useConfirmStore';
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
  const confirm = useConfirm();
  const { t } = useTranslation();
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

  const askCancel = async (id: number, name: string) => {
    const ok = await confirm({
      title: `Cancel ${name}'s spot?`,
      message: "The invitation will stay visible (struck through) and the seats free up for someone else.",
      confirmLabel: 'Cancel invitation',
      destructive: true,
    });
    if (ok) toggleCancelled(id);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="page-title">{t('guests.title')}</div>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => open('addGuest')}
              >{t('guests.addBtn')}</button>
            </div>
            <div style={{ overflowX: 'auto', display: 'flex', gap: 6, marginTop: 10, paddingBottom: 10 }}>
              <button className={`tog-btn ${activeVenue === 'all' ? 'on' : ''}`} onClick={() => setActiveVenue('all')}>{t('guests.venueAll')}</button>
              {venues.map((v) => (
                <button
                  key={v.id}
                  className={`tog-btn ${activeVenue === v.id ? 'on' : ''}`}
                  onClick={() => setActiveVenue(v.id)}
                >{v.name}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', paddingBottom: 6 }}>
              {t('guests.swipeHint')}
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
                  {/* Left side: arrived. Closes after 1s so the user
                      sees the action confirmed before the panel slides
                      back to the normal list view. */}
                  <IonItemOptions
                    side="start"
                    onIonSwipe={(ev) => {
                      toggleArrived(g.id);
                      const ion = (ev.target as HTMLElement).closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
                      setTimeout(() => ion?.close(), 1000);
                    }}
                  >
                    <IonItemOption
                      expandable
                      color={isArrived ? 'medium' : 'primary'}
                      onClick={(ev) => {
                        toggleArrived(g.id);
                        const ion = ev.currentTarget.closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
                        setTimeout(() => ion?.close(), 1000);
                      }}
                    >
                      {isArrived ? t('guests.markPending') : t('guests.markArrived')}
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
                          {venueName(g.venueId, venues)} · {(g.timeslotNames || []).join(' · ') || 'No slot'} · {g.pax} pax
                        </div>
                      </div>
                      <div className="list-right">
                        <div className={`list-right-sub state-label state-label--${rowState}`}>
                          {isArrived ? t('guests.arrived') : isCancelled ? t('guests.cancelled') : t('guests.pending')}
                        </div>
                        {g.clubEventId && (
                          <Pill tone="purple" style={{ fontSize: 10, marginTop: 3, display: 'inline-block' }}>
                            🌙 Club
                          </Pill>
                        )}
                      </div>
                    </div>
                  </IonItem>

                  {/* Right side: cancel (with styled confirmation prompt). */}
                  <IonItemOptions
                    side="end"
                    onIonSwipe={async (ev) => {
                      const ion = (ev.target as HTMLElement).closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
                      if (isCancelled) {
                        toggleCancelled(g.id);            // restore — no confirm needed
                      } else {
                        await askCancel(g.id, g.name);    // confirm dialog handles actual cancel
                      }
                      setTimeout(() => ion?.close(), 1000);
                    }}
                  >
                    <IonItemOption
                      expandable
                      color={isCancelled ? 'medium' : 'danger'}
                      onClick={async (ev) => {
                        const ion = ev.currentTarget.closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
                        if (isCancelled) toggleCancelled(g.id);
                        else await askCancel(g.id, g.name);
                        setTimeout(() => ion?.close(), 1000);
                      }}
                    >
                      {isCancelled ? t('guests.restore') : t('guests.cancelInvite')}
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              );
            })}
          </IonList>
        ) : (
          <EmptyBox>
            {t('guests.empty')}<br />
            <span dangerouslySetInnerHTML={{ __html: t('guests.emptySub') }} />
          </EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
