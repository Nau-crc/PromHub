import React from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { today } from '@/core/constants';
import { fmtDateLong } from '@/core/utils/date';
import { EventCard } from '@/components/EventCard';
import { EmptyBox } from '@/components/EmptyBox';

export const HomePage: React.FC = () => {
  const events = useAppStore((s) => s.events);
  const open = useUIStore((s) => s.open);

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
        {events.length ? events.map((e) => (
          <EventCard key={e.id} event={e} onClick={() => open('eventDetail', { id: e.id })} />
        )) : (
          <EmptyBox>
            No events yet.<br />
            Tap <b>+ Event</b> to add your first night.
          </EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
