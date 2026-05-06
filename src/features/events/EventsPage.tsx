import React, { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { EventCard } from '@/components/EventCard';
import { EmptyBox } from '@/components/EmptyBox';

export const EventsPage: React.FC = () => {
  const events = useAppStore((s) => s.events);
  const open = useUIStore((s) => s.open);

  // 0 = all, 1 = this week, 2 = next week — same semantics as MVP
  // (the MVP doesn't filter by date; the toggles are presentational)
  const [weekFilter, setWeekFilter] = useState<0 | 1 | 2>(1);

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
              <button className={`tog-btn ${weekFilter === 1 ? 'on' : ''}`} onClick={() => setWeekFilter(1)}>This week</button>
              <button className={`tog-btn ${weekFilter === 2 ? 'on' : ''}`} onClick={() => setWeekFilter(2)}>Next week</button>
              <button className={`tog-btn ${weekFilter === 0 ? 'on' : ''}`} onClick={() => setWeekFilter(0)}>All</button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {events.length ? events.map((e) => (
          <EventCard key={e.id} event={e} onClick={() => open('eventDetail', { id: e.id })} />
        )) : (
          <EmptyBox>No events yet.</EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
