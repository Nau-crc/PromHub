import React, { useEffect, useMemo, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton,
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
//  Behaviour rules (from product):
//    1. Only guests whose `eventDate === today` (or whose event
//       occurs today AND eventDate is null) appear.
//    2. Guests are grouped under their event so you can scan the
//       night's lists at a glance.
//    3. Drag-and-drop: dragging a guest row onto another event's
//       group reassigns the guest to that event (and pins their
//       date to today). Native HTML5 DnD — desktop-first; on
//       mobile the user can fall back to editing the guest.
//    4. The page polls every 20s while visible so guests landing
//       via the public registration form appear without manual
//       refresh.
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

  // Bucket guests by event id for rendering.
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
  // Only ticks while the document is visible — no point burning
  // bandwidth when the app is backgrounded.
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

  // ── Drag-and-drop wiring ───────────────────────────────────
  // Plain HTML5 DnD: each guest row is `draggable`, each event
  // group is a drop target. We carry the guest id in dataTransfer.
  const [dropTargetEventId, setDropTargetEventId] = useState<number | null>(null);

  const onDragStartGuest = (e: React.DragEvent<HTMLDivElement>, guestId: number) => {
    e.dataTransfer.setData('text/plain', String(guestId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOverGroup = (e: React.DragEvent<HTMLDivElement>, eventId: number) => {
    e.preventDefault(); // required to allow drop
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
      // Update the guest's event + venue. Timeslot pins reference the
      // OLD event's slots so they're meaningless on the new event;
      // clear them — the promoter re-picks if it matters.
      await upsertGuest({
        ...g,
        eventId: targetEventId,
        venueId: targetEvent.venueId ?? g.venueId,
        eventDate: todayIso,
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
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', padding: '8px 0 6px' }}>
              Showing today's guests, grouped by event. Drag a guest into another group to reassign.
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {todayEvents.length === 0 ? (
          <EmptyBox>
            No events scheduled for today.
          </EmptyBox>
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
                      return (
                        <div
                          key={g.id}
                          draggable
                          onDragStart={(e) => onDragStartGuest(e, g.id)}
                          onClick={() => open('guestDetail', { id: g.id })}
                          className={`guest-row state-${rowState}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            borderBottom: '0.5px solid var(--color-border-tertiary)',
                            cursor: 'grab',
                          }}
                        >
                          <span className={`status-dot status-dot--${rowState}`} />
                          <Avatar name={g.name} handle={g.igHandle} platform={g.igPlatform} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="list-name" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleArrived(g.id); }}
                              className="btn-sm"
                              style={{
                                fontSize: 11,
                                background: isArrived ? '#EAF3DE' : 'transparent',
                                color: isArrived ? '#0F6E56' : 'var(--color-text-secondary)',
                                border: '0.5px solid var(--color-border-tertiary)',
                              }}
                            >
                              {isArrived ? '✓ Arrived' : 'Mark arrived'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isCancelled) toggleCancelled(g.id);
                                else askCancel(g.id, g.name);
                              }}
                              className="btn-sm"
                              style={{
                                fontSize: 11,
                                background: 'transparent',
                                color: isCancelled ? 'var(--color-text-secondary)' : '#A32D2D',
                                border: '0.5px solid var(--color-border-tertiary)',
                              }}
                            >
                              {isCancelled ? 'Restore' : 'Cancel'}
                            </button>
                          </div>
                        </div>
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
