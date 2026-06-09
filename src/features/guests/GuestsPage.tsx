import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton,
  IonItemSliding, IonItem, IonItemOptions, IonItemOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { Guest, PromEvent, Timeslot } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { useConfirm } from '@/store/useConfirmStore';
import { occurs, venueById, isGuestOnEvent } from '@/features/summary/calculations';
import { today } from '@/core/constants';
import { isoDay } from '@/core/utils/date';
import { StarBadge, SocialBadge } from '@/components/SocialBadge';
import { Avatar } from '@/components/Avatar';
import { Pill } from '@/components/Pill';
import { EmptyBox } from '@/components/EmptyBox';

// ─────────────────────────────────────────────────────────────
//  Guests page — TODAY-only view, grouped by event, optionally
//  sub-grouped by timeslot when an event has more than one slot.
//
//  Layout rules:
//    1. Only today-occurring events render groups.
//    2. A guest with main event A + late-club B appears under both.
//    3. If an event has >1 selected slot:
//         - One sub-bucket per slot (named, time-ranged)
//         - One "Unassigned" sub-bucket at the end for guests
//           whose `timeslotIds` is empty (legacy or didn't pick)
//       A guest in two slots shows in BOTH sub-buckets.
//       If the event has 0 or 1 slot, the list stays flat.
//
//  Drag-and-drop rules:
//    Same gesture (the `≡` handle), three contexts:
//      a) Drop on a different EVENT      → reassign main/club event
//      b) Drop on a different SLOT of the SAME event
//                                        → swap the source slot for
//                                          the target in `timeslotIds`
//                                          (other slots untouched)
//      c) Drop on the unassigned bucket  → remove the source slot
//                                          (or all slots when from a
//                                          different event)
//    The drag payload encodes `guestId:sourceEventId:sourceSlotId`
//    (sourceSlotId is empty for unassigned/single-slot origins).
//
//  Plus the existing 20s background poll while visible.
// ─────────────────────────────────────────────────────────────

const POLL_MS = 20_000;
const UNASSIGNED = '__unassigned__';

interface SlotDivision {
  /** Real venue timeslots filtered to the event's selectedSlotIds. */
  slots: Timeslot[];
  /** True if the event has 0 or 1 slot — render flat, no subdivisions. */
  single: boolean;
}

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

  // Today's events — the only ones we render groups for.
  const todayEvents: PromEvent[] = useMemo(() => {
    return events.filter((e) => occurs(e, todayIso));
  }, [events, todayIso]);
  const todayEventIds = useMemo(() => new Set(todayEvents.map((e) => e.id)), [todayEvents]);

  // Today's guests: at least one of their event links (main OR club)
  // points to a today-event AND they're pinned to today or unpinned.
  const todayGuests = useMemo(() => {
    return guests.filter((g) => {
      const mainOnToday = g.eventId != null && todayEventIds.has(g.eventId);
      const clubOnToday = g.clubEventId != null && todayEventIds.has(g.clubEventId);
      if (!mainOnToday && !clubOnToday) return false;
      return !g.eventDate || g.eventDate === todayIso;
    });
  }, [guests, todayEventIds, todayIso]);

  // Top-level bucket: which guests fall under each event id (main or club).
  const guestsByEvent = useMemo(() => {
    const map = new Map<number, Guest[]>();
    todayEvents.forEach((e) => map.set(e.id, []));
    for (const g of todayGuests) {
      for (const ev of todayEvents) {
        if (isGuestOnEvent(g, ev.id)) {
          map.get(ev.id)!.push(g);
        }
      }
    }
    return map;
  }, [todayEvents, todayGuests]);

  // For each event, resolve its selected slots against the venue
  // definitions so we can render proper names + time ranges.
  const divisionByEvent = useMemo(() => {
    const map = new Map<number, SlotDivision>();
    for (const ev of todayEvents) {
      const v = ev.venueId != null ? venueById(ev.venueId, venues) : undefined;
      if (!v) {
        map.set(ev.id, { slots: [], single: true });
        continue;
      }
      const slotIdSet = new Set(ev.selectedSlotIds || []);
      const slots = (v.timeslots || []).filter((ts) => slotIdSet.has(ts.id));
      map.set(ev.id, { slots, single: slots.length <= 1 });
    }
    return map;
  }, [todayEvents, venues]);

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
  // Composite drop-target key: `${eventId}:${slotId ?? ''}`. Empty
  // slotId means "the event as a whole" (single-slot event) or
  // "unassigned" (when the slot id sentinel is UNASSIGNED, see below).
  const [dropKey, setDropKey] = useState<string | null>(null);

  const onDragStartGuest = (
    e: React.DragEvent<HTMLElement>,
    guestId: number,
    sourceEventId: number,
    sourceSlotId: string, // '' for single-slot / unassigned origin
  ) => {
    e.dataTransfer.setData('text/plain', `${guestId}:${sourceEventId}:${sourceSlotId}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOverBucket = (
    e: React.DragEvent<HTMLDivElement>,
    targetEventId: number,
    targetSlotId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const key = `${targetEventId}:${targetSlotId}`;
    if (dropKey !== key) setDropKey(key);
  };

  const onDragLeaveBucket = (
    _e: React.DragEvent<HTMLDivElement>,
    targetEventId: number,
    targetSlotId: string,
  ) => {
    const key = `${targetEventId}:${targetSlotId}`;
    if (dropKey === key) setDropKey(null);
  };

  /**
   * Drop handler. `targetSlotId` semantics:
   *   - real slot id  → drop on a specific slot sub-bucket
   *   - UNASSIGNED    → drop on the "no slot" sub-bucket
   *   - ''            → drop on the whole event (single-slot mode)
   */
  const onDropOnBucket = async (
    e: React.DragEvent<HTMLDivElement>,
    targetEventId: number,
    targetSlotId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDropKey(null);

    const raw = e.dataTransfer.getData('text/plain');
    const parts = raw.split(':');
    const guestId = Number(parts[0]);
    const sourceEventId = Number(parts[1]);
    const sourceSlotId = parts[2] ?? '';
    if (!Number.isFinite(guestId) || !Number.isFinite(sourceEventId)) return;
    if (sourceEventId === targetEventId && sourceSlotId === targetSlotId) return;

    const g = guests.find((x) => x.id === guestId);
    if (!g) return;
    const targetEvent = events.find((ev) => ev.id === targetEventId);
    if (!targetEvent) return;

    try {
      if (sourceEventId === targetEventId) {
        // ── Same event → swap slot in `timeslotIds` ─────────
        let newSlotIds = [...(g.timeslotIds || [])];
        if (sourceSlotId && sourceSlotId !== UNASSIGNED) {
          newSlotIds = newSlotIds.filter((id) => id !== sourceSlotId);
        }
        if (targetSlotId && targetSlotId !== UNASSIGNED) {
          if (!newSlotIds.includes(targetSlotId)) newSlotIds.push(targetSlotId);
        }
        const venue = venues.find((v) => v.id === g.venueId);
        const newSlotNames = newSlotIds
          .map((id) => venue?.timeslots.find((ts) => ts.id === id)?.name || '')
          .filter(Boolean);
        await upsertGuest({
          ...g,
          timeslotIds: newSlotIds,
          timeslotNames: newSlotNames,
        });
        return;
      }

      // ── Cross-event → reassign main or club, possibly pre-pick slot ──
      // If we dragged from the guest's club bucket (and her main lives
      // elsewhere) → rewrite clubEventId; otherwise rewrite the main.
      const updatingClub =
        g.clubEventId === sourceEventId && g.eventId !== sourceEventId;

      if (updatingClub) {
        await upsertGuest({ ...g, clubEventId: targetEventId });
        return;
      }

      // Cross-event main reassignment. Pre-pick the target slot for
      // her, if the user dropped on a specific one. Otherwise clear.
      const targetVenue = venues.find((v) => v.id === targetEvent.venueId);
      const newSlotIds =
        targetSlotId && targetSlotId !== UNASSIGNED ? [targetSlotId] : [];
      const newSlotNames = newSlotIds
        .map((id) => targetVenue?.timeslots.find((ts) => ts.id === id)?.name || '')
        .filter(Boolean);
      await upsertGuest({
        ...g,
        eventId: targetEventId,
        venueId: targetEvent.venueId ?? g.venueId,
        eventDate: todayIso,
        timeslotIds: newSlotIds,
        timeslotNames: newSlotNames,
      });
    } catch (err) {
      alert(t('guests.couldntMove', { message: (err as Error).message }));
    }
  };

  const askCancel = async (id: number, name: string) => {
    const ok = await confirm({
      title: t('guests.cancelTitle', { name }),
      message: t('guests.cancelMessage'),
      confirmLabel: t('guests.cancelConfirm'),
      destructive: true,
    });
    if (ok) toggleCancelled(id);
  };

  // First-row-across-all-groups tracker for the swipe-hint demo.
  let firstRowAssigned = false;

  // ── Render helpers ─────────────────────────────────────────
  const renderGuestRow = (
    g: Guest,
    sourceEventId: number,
    sourceSlotId: string,
  ) => {
    const isArrived = g.checked;
    const isCancelled = !!g.cancelled;
    const rowState = isArrived ? 'arrived' : isCancelled ? 'cancelled' : 'pending';
    const isFirstRow = !firstRowAssigned;
    if (isFirstRow) firstRowAssigned = true;
    // Same g.id may appear in multiple groups/slots so the React key
    // must be composite to stay unique within each list array.
    const rowKey = `${sourceEventId}:${sourceSlotId}:${g.id}`;
    return (
      <IonItemSliding
        key={rowKey}
        ref={isFirstRow ? firstRowRef : undefined}
        className={`guest-sliding-item state-${rowState}`}
      >
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
            {/* Drag handle. ONLY this is draggable — swipes anywhere
                else stay with Ionic's gesture engine. Encodes the
                source eventId + slotId so the drop handler can do the
                right thing (intra-event slot swap vs cross-event). */}
            <span
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                onDragStartGuest(e, g.id, sourceEventId, sourceSlotId);
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={t('guests.dragAria', { name: g.name })}
              title={t('guests.dragTitle')}
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
  };

  /** A drop-target wrapper around a slot sub-bucket. */
  const renderBucket = (
    eventId: number,
    slotId: string,
    label: React.ReactNode,
    sublabel: React.ReactNode,
    guestList: Guest[],
    placeholder: string,
  ) => {
    const key = `${eventId}:${slotId}`;
    const isTarget = dropKey === key;
    const totalPax = guestList.filter((g) => !g.cancelled).reduce((a, g) => a + g.pax, 0);
    return (
      <div
        key={key}
        onDragOver={(e) => onDragOverBucket(e, eventId, slotId)}
        onDragLeave={(e) => onDragLeaveBucket(e, eventId, slotId)}
        onDrop={(e) => onDropOnBucket(e, eventId, slotId)}
        style={{
          borderTop: '0.5px solid var(--color-border-tertiary)',
          background: isTarget ? 'rgba(249,115,22,.08)' : 'transparent',
          transition: 'background-color 120ms',
        }}
      >
        <div style={{
          padding: '8px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--color-background-primary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {label}
            </div>
            {sublabel && (
              <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                {sublabel}
              </div>
            )}
          </div>
          <Pill tone="gray">{totalPax} pax</Pill>
        </div>
        {guestList.length === 0 ? (
          <div style={{
            padding: '12px', fontSize: 11,
            color: 'var(--color-text-secondary)',
            textAlign: 'center', fontStyle: 'italic',
          }}>
            {placeholder}
          </div>
        ) : (
          guestList.map((g) => renderGuestRow(g, eventId, slotId))
        )}
      </div>
    );
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
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', padding: '8px 0 6px', lineHeight: 1.5 }}>
              {t('guests.todayHint', { handle: '≡' })}
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {todayEvents.length === 0 ? (
          <EmptyBox>{t('guests.noEventsToday')}</EmptyBox>
        ) : (
          <div style={{ padding: '0 16px' }}>
            {todayEvents.map((ev) => {
              const list = guestsByEvent.get(ev.id) ?? [];
              const division = divisionByEvent.get(ev.id) ?? { slots: [], single: true };
              // De-duplicated unique guests for the header pax sum, so
              // a guest in two slots doesn't get counted twice here.
              const uniqueGuests = Array.from(new Map(list.map((g) => [g.id, g])).values());
              const totalPax = uniqueGuests.filter((g) => !g.cancelled).reduce((a, g) => a + g.pax, 0);

              return (
                <div
                  key={ev.id}
                  style={{
                    margin: '0 0 18px',
                    border: '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'var(--color-background-secondary)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Event header — only the four pieces of metadata the
                      promoter cares about per the product rule:
                      event name, capacity, "private" flag, "late club"
                      flag. Venue name lives elsewhere (event detail);
                      surfacing it here as a chip made it look like a
                      category tag, which it isn't. */}
                  <div style={{
                    padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8,
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        display: 'flex', alignItems: 'center', gap: 6,
                        flexWrap: 'wrap',
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ev.name}
                        </span>
                        {ev.isPrivate && (
                          <Pill tone="pink" style={{ fontSize: 9 }}>{t('common.private')}</Pill>
                        )}
                        {ev.isLateClub && (
                          <Pill tone="purple" style={{ fontSize: 9 }}>{t('common.lateClub')}</Pill>
                        )}
                      </div>
                    </div>
                    {ev.capacity ? (
                      <Pill tone="blue">{totalPax}/{ev.capacity}</Pill>
                    ) : (
                      <Pill tone="gray">{totalPax} pax</Pill>
                    )}
                  </div>

                  {division.single ? (
                    // ── Flat list (event with 0 or 1 slot) ──
                    (() => {
                      const onlySlotId = division.slots[0]?.id ?? '';
                      return renderBucket(
                        ev.id,
                        onlySlotId,
                        division.slots[0]?.name ?? t('eventDetail.guests'),
                        division.slots[0]
                          ? `${division.slots[0].startTime}–${division.slots[0].endTime}`
                          : null,
                        list,
                        t('guests.dropHere'),
                      );
                    })()
                  ) : (
                    // ── Subdivided by slot ──
                    <>
                      {division.slots.map((slot) => {
                        const slotGuests = list.filter((g) =>
                          (g.timeslotIds || []).includes(slot.id),
                        );
                        return renderBucket(
                          ev.id,
                          slot.id,
                          slot.name,
                          `${slot.startTime}–${slot.endTime}`,
                          slotGuests,
                          t('guests.dropSlotHere', { slot: slot.name }),
                        );
                      })}
                      {/* Catch-all for guests without a picked slot */}
                      {(() => {
                        const orphans = list.filter(
                          (g) => !(g.timeslotIds || []).length,
                        );
                        if (!orphans.length) return null;
                        return renderBucket(
                          ev.id,
                          UNASSIGNED,
                          t('guests.unassigned'),
                          t('guests.unassignedHint'),
                          orphans,
                          t('guests.noUnassigned'),
                        );
                      })()}
                    </>
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
