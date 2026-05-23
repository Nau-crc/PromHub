import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton,
  IonItemSliding, IonItem, IonItemOptions, IonItemOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { Guest, PromEvent } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { useConfirm } from '@/store/useConfirmStore';
import { occurs, venueById } from '@/features/summary/calculations';
import { today } from '@/core/constants';
import { isoDay } from '@/core/utils/date';
import { StarBadge, SocialBadge } from '@/components/SocialBadge';
import { Avatar } from '@/components/Avatar';
import { Pill } from '@/components/Pill';
import { EmptyBox } from '@/components/EmptyBox';

// ─────────────────────────────────────────────────────────────
//  Guests page — TODAY-only view, grouped by event.
//
//  Two distinct gestures live on each row:
//    1. SWIPE (Ionic IonItemSliding): horizontal pan reveals
//       "Arrived" (left side) / "Cancel" (right side) — fast
//       one-handed actions while the promoter is at the door.
//    2. DRAG (native HTML5 DnD via a dedicated grip handle on the
//       right edge): drop a guest onto a different event group to
//       reassign her (eventId + venueId updated, eventDate pinned
//       to today, timeslot pins cleared).
//
//  The two coexist because they listen to different inputs:
//    - Swipes: pointer/touch events on the IonItem body.
//    - DnD:    `draggable` is set ONLY on the grip handle, so the
//              browser's drag gesture starts from that element and
//              never from a pan across the row.
//
//  Plus a 20s background poll while the document is visible, so
//  guests arriving via the public registration form appear without
//  a manual refresh.
// ─────────────────────────────────────────────────────────────

const POLL_MS = 20_000;

export const GuestsPage: React.FC = () => {
  const {
    venues, events, guests, refresh,
    toggleArrived, toggleCancelled, upsertGuest,
  } = useAppStore((s) => ({
    venues: s.venues, events: s.events, guests: s.guests,
    refresh: s.refresh,
    toggleArrived: s.toggleArrived, toggleCancelled: s.toggleCancelled,
    upsertGuest: s.upsertGuest,
  }));
  const open = useUIStore((s) => s.open);
  const confirm = useConfirm();
  const { t } = useTranslation();

  const todayIso = useMemo(() => isoDay(today()), []);

  // Today's events — the only ones we render groups for. A guest
  // whose event isn't running today shouldn't even be considered.
  const todayEvents: PromEvent[] = useMemo(() => {
    return events.filter((e) => occurs(e, todayIso));
  }, [events, todayIso]);
  const todayEventIds = useMemo(() => new Set(todayEvents.map((e) => e.id)), [todayEvents]);

  // Today's guests: assigned to a today-event, AND either explicitly
  // pinned to today, or unpinned (legacy / pre-occurrence-pinning).
  // Past-dated guests are filtered out per the product rule.
  const todayGuests = useMemo(() => {
    return guests.filter((g) => {
      if (g.eventId == null) return false;
      if (!todayEventIds.has(g.eventId)) return false;
      return !g.eventDate || g.eventDate === todayIso;
    });
  }, [guests, todayEventIds, todayIso]);

  // Bucket by event id for rendering.
  const guestsByEvent = useMemo(() => {
    const map = new Map<number, Guest[]>();
    todayEvents.forEach((e) => map.set(e.id, []));
    for (const g of todayGuests) {
      const arr = map.get(g.eventId!);
      if (arr) arr.push(g);
    }
    return map;
  }, [todayEvents, todayGuests]);

  // ── Polling for new public-form submissions ─────────────────
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      if (cancelled) return;
      await refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  // ── Swipe affordance hint ──────────────────────────────────
  // Demo the swipe action once per mount on the first visible
  // guest row so users discover the gesture without a tutorial.
  const firstRowRef = useRef<HTMLIonItemSlidingElement | null>(null);
  const peekedRef = useRef(false);
  useEffect(() => {
    if (peekedRef.current) return;
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
  }, [todayGuests.length]);

  // ── Drag-and-drop wiring ───────────────────────────────────
  const [dropTargetEventId, setDropTargetEventId] = useState<number | null>(null);

  const onDragStartGuest = (e: React.DragEvent<HTMLElement>, guestId: number) => {
    e.dataTransfer.setData('text/plain', String(guestId));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOverGroup = (e: React.DragEvent<HTMLDivElement>, eventId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetEventId !== eventId) setDropTargetEventId(eventId);
  };
  const onDragLeaveGroup = (_e: React.DragEvent<HTMLDivElement>, eventId: number) => {
    if (dropTargetEventId === eventId) setDropTargetEventId(null);
  };
  const onDropOnGroup = async (e: React.DragEvent<HTMLDivElement>, targetEventId: number) => {
    e.preventDefault();
    setDropTargetEventId(null);
    const raw = e.dataTransfer.getData('text/plain');
    const guestId = Number(raw);
    if (!Number.isFinite(guestId)) return;
    const g = guests.find((x) => x.id === guestId);
    if (!g || g.eventId === targetEventId) return;
    const targetEvent = events.find((ev) => ev.id === targetEventId);
    if (!targetEvent) return;
    try {
      await upsertGuest({
        ...g,
        eventId: targetEventId,
        venueId: targetEvent.venueId ?? g.venueId,
        eventDate: todayIso,
        // The old event's timeslot ids don't refer to anything on
        // the new event — clear them. Promoter re-picks if needed.
        timeslotIds: [],
        timeslotNames: [],
      });
    } catch (err) {
      alert(`Couldn't move guest: ${(err as Error).message}`);
    }
  };

  const askCancel = async (id: number, name: string) => {
    const ok = await confirm({
      title: `Cancel ${name}'s spot?`,
      message: "The invitation will stay visible (struck through) and the seats free up for someone else.",
      confirmLabel: 'Cancel invitation',
      destructive: true,
    });
    if (ok) toggleCancelled(id);
  };

  // Track the index of the very first guest row across ALL groups
  // so the hint demo plays exactly once on the topmost row.
  let firstRowAssigned = false;

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
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', padding: '8px 0 6px', lineHeight: 1.5 }}>
              Today's guests, grouped by event. Swipe ← to cancel, → to mark arrived.
              Drag the <span style={{ fontFamily: 'monospace', opacity: .8 }}>≡</span> handle to move someone to another event.
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {todayEvents.length === 0 ? (
          <EmptyBox>No events scheduled for today.</EmptyBox>
        ) : (
          <div style={{ padding: '0 16px' }}>
            {todayEvents.map((ev) => {
              const list = guestsByEvent.get(ev.id) ?? [];
              const v = ev.venueId != null ? venueById(ev.venueId, venues) : undefined;
              const isDropTarget = dropTargetEventId === ev.id;
              const totalPax = list.filter((g) => !g.cancelled).reduce((a, g) => a + g.pax, 0);
              return (
                <div
                  key={ev.id}
                  onDragOver={(e) => onDragOverGroup(e, ev.id)}
                  onDragLeave={(e) => onDragLeaveGroup(e, ev.id)}
                  onDrop={(e) => onDropOnGroup(e, ev.id)}
                  style={{
                    margin: '0 0 18px',
                    border: isDropTarget
                      ? '2px dashed var(--color-primary)'
                      : '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 'var(--border-radius-md)',
                    background: isDropTarget
                      ? 'rgba(249,115,22,.05)'
                      : 'var(--color-background-secondary)',
                    transition: 'background-color 120ms, border-color 120ms',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    padding: '10px 14px',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {ev.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        {v ? v.name : 'No venue'} · {totalPax} pax
                      </div>
                    </div>
                    {ev.capacity ? (
                      <Pill tone="blue">{totalPax}/{ev.capacity}</Pill>
                    ) : null}
                  </div>
                  {list.length === 0 ? (
                    <div style={{
                      padding: '14px', fontSize: 12,
                      color: 'var(--color-text-secondary)',
                      textAlign: 'center', fontStyle: 'italic',
                    }}>
                      No guests yet — drop someone here.
                    </div>
                  ) : (
                    list.map((g) => {
                      const isArrived = g.checked;
                      const isCancelled = !!g.cancelled;
                      const rowState = isArrived ? 'arrived' : isCancelled ? 'cancelled' : 'pending';
                      const isFirstRow = !firstRowAssigned;
                      if (isFirstRow) firstRowAssigned = true;
                      return (
                        <IonItemSliding
                          key={g.id}
                          ref={isFirstRow ? firstRowRef : undefined}
                          className={`guest-sliding-item state-${rowState}`}
                        >
                          {/* Left side: arrived. Closes after 1s so the user
                              sees the confirmation before sliding back. */}
                          <IonItemOptions
                            side="start"
                            onIonSwipe={(ev) => {
                              toggleArrived(g.id);
                              const ion = (ev.target as HTMLElement)
                                .closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
                              setTimeout(() => ion?.close(), 1000);
                            }}
                          >
                            <IonItemOption
                              expandable
                              color={isArrived ? 'medium' : 'primary'}
                              onClick={(ev) => {
                                toggleArrived(g.id);
                                const ion = ev.currentTarget
                                  .closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
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
                                  {(g.timeslotNames || []).join(' · ') || 'No slot'} · {g.pax} pax
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
                              {/* Drag handle. ONLY this element is draggable —
                                  swipes anywhere else on the row still go to
                                  Ionic's gesture engine. Stops click + pointer
                                  propagation so a tap on the handle doesn't
                                  also open the guest detail. */}
                              <span
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  onDragStartGuest(e, g.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                aria-label={`Drag ${g.name} to another event`}
                                title="Drag to another event"
                                style={{
                                  cursor: 'grab',
                                  padding: '6px 8px',
                                  marginLeft: 6,
                                  fontSize: 16,
                                  color: 'var(--color-text-secondary)',
                                  userSelect: 'none',
                                  lineHeight: 1,
                                }}
                              >
                                ≡
                              </span>
                            </div>
                          </IonItem>

                          {/* Right side: cancel (with confirmation). */}
                          <IonItemOptions
                            side="end"
                            onIonSwipe={async (ev) => {
                              const ion = (ev.target as HTMLElement)
                                .closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
                              if (isCancelled) {
                                toggleCancelled(g.id);
                              } else {
                                await askCancel(g.id, g.name);
                              }
                              setTimeout(() => ion?.close(), 1000);
                            }}
                          >
                            <IonItemOption
                              expandable
                              color={isCancelled ? 'medium' : 'danger'}
                              onClick={async (ev) => {
                                const ion = ev.currentTarget
                                  .closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
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
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
