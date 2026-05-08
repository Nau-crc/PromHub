import React, { useMemo } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { today } from '@/core/constants';
import { fmtDateLong, isoDay } from '@/core/utils/date';
import { occurs } from '@/features/summary/calculations';
import { EventCard } from '@/components/EventCard';
import { EmptyBox } from '@/components/EmptyBox';

export const HomePage: React.FC = () => {
  const events = useAppStore((s) => s.events);
  const open = useUIStore((s) => s.open);

  // Today's events: one-time matching today, OR recurring whose
  // weekday + season covers today.
  const todayKey = isoDay(today());
  const todayEvents = useMemo(
    () => events.filter((e) => occurs(e, todayKey)),
    [events, todayKey],
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="page-title">{fmtDateLong(today())}</div>
                <div className="page-sub">Today's events</div>
              </div>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => open('addEvent')}
              >
                + Event
              </button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {todayEvents.length ? todayEvents.map((e) => (
          <EventCard key={e.id} event={e} occurrenceDate={todayKey} onClick={() => open('eventDetail', { id: e.id })} />
        )) : (
          <EmptyBox>
            No events today.<br />
            All scheduled events will show here on their date.
          </EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
