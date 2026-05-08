import React, { useMemo, useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { today } from '@/core/constants';
import { isoDay } from '@/core/utils/date';
import { occurs } from '@/features/summary/calculations';
import { EventCard } from '@/components/EventCard';
import { EmptyBox } from '@/components/EmptyBox';

type EventFilter = 'upcoming' | 'past' | 'all';

export const EventsPage: React.FC = () => {
  const events = useAppStore((s) => s.events);
  const open = useUIStore((s) => s.open);
  const [filter, setFilter] = useState<EventFilter>('upcoming');

  const todayKey = isoDay(today());

  // Classify each event as upcoming / past based on its season or single date.
  const isPast = (e: typeof events[number]): boolean => {
    if (e.isOneTime) return !!e.eventDate && e.eventDate < todayKey;
    if (e.seasonEnd) return e.seasonEnd < todayKey;
    return false; // open-ended recurring → never past
  };
  const isUpcoming = (e: typeof events[number]): boolean => {
    if (e.isOneTime) return !!e.eventDate && e.eventDate >= todayKey;
    if (e.seasonStart && e.seasonStart > todayKey) return true;
    if (e.seasonEnd && e.seasonEnd < todayKey) return false;
    return true; // currently running or open-ended
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    if (filter === 'past') return events.filter(isPast);
    return events.filter(isUpcoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, filter, todayKey]);

  // Sort: events happening today first, then upcoming by date, then by name
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aOccursToday = occurs(a, todayKey) ? 0 : 1;
      const bOccursToday = occurs(b, todayKey) ? 0 : 1;
      if (aOccursToday !== bOccursToday) return aOccursToday - bOccursToday;
      const aDate = a.isOneTime ? (a.eventDate ?? '') : (a.seasonStart ?? '');
      const bDate = b.isOneTime ? (b.eventDate ?? '') : (b.seasonStart ?? '');
      if (aDate && bDate && aDate !== bDate) return aDate < bDate ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, todayKey]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="page-title">Events</div>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => open('addEvent')}
              >+ Add</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingBottom: 10 }}>
              <button className={`tog-btn ${filter === 'upcoming' ? 'on' : ''}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
              <button className={`tog-btn ${filter === 'past' ? 'on' : ''}`} onClick={() => setFilter('past')}>Past</button>
              <button className={`tog-btn ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All</button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {sorted.length ? sorted.map((e) => (
          <EventCard key={e.id} event={e} onClick={() => open('eventDetail', { id: e.id })} />
        )) : (
          <EmptyBox>No events in this view.</EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
