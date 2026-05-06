import React, { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp, IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon,
  IonMenu, IonHeader, IonToolbar, IonContent, IonList, IonItem,
  IonSplitPane, IonTitle, setupIonicReact, IonMenuToggle,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  homeOutline, peopleOutline, listOutline, ellipsisHorizontal,
  calendarOutline, businessOutline, statsChartOutline, addOutline,
} from 'ionicons/icons';

import { HomePage } from '@/features/home/HomePage';
import { GuestsPage } from '@/features/guests/GuestsPage';
import { ReservationsPage } from '@/features/reservations/ReservationsPage';
import { EventsPage } from '@/features/events/EventsPage';
import { VenuesPage } from '@/features/venues/VenuesPage';
import { SummaryPage } from '@/features/summary/SummaryPage';

import { ModalsHost } from '@/features/ModalsHost';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';

setupIonicReact({ mode: 'ios' });

const Drawer: React.FC = () => {
  const open = useUIStore((s) => s.open);
  return (
    <IonMenu contentId="main" type="overlay">
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, background: '#1a1a1a', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#F97316', fontWeight: 700, fontSize: 11 }}>P</span>
              </div>
              <span>PromHub</span>
            </div>
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ padding: '14px 20px 4px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Manage
        </div>
        <IonList lines="full">
          <IonMenuToggle autoHide={false}>
            <IonItem button routerLink="/events" detail>
              <IonIcon slot="start" icon={calendarOutline} />
              <IonLabel>
                <h3>Events</h3>
                <p>Recurring nights & schedule</p>
              </IonLabel>
            </IonItem>
            <IonItem button routerLink="/venues" detail>
              <IonIcon slot="start" icon={businessOutline} />
              <IonLabel>
                <h3>Venues</h3>
                <p>Places, timeslots, VIP & invite types</p>
              </IonLabel>
            </IonItem>
            <IonItem button routerLink="/summary" detail>
              <IonIcon slot="start" icon={statsChartOutline} />
              <IonLabel>
                <h3>Summary</h3>
                <p>Earnings, charts & influencers</p>
              </IonLabel>
            </IonItem>
          </IonMenuToggle>
        </IonList>

        <div style={{ padding: '14px 20px 4px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Quick add
        </div>
        <IonList lines="full">
          <IonMenuToggle autoHide={false}>
            <IonItem button onClick={() => open('addEvent')}>
              <IonIcon slot="start" icon={addOutline} color="primary" />
              <IonLabel><h3>New event</h3></IonLabel>
            </IonItem>
            <IonItem button onClick={() => open('addVenue')}>
              <IonIcon slot="start" icon={addOutline} color="primary" />
              <IonLabel><h3>New venue</h3></IonLabel>
            </IonItem>
          </IonMenuToggle>
        </IonList>
      </IonContent>
    </IonMenu>
  );
};

const Tabs: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet id="main">
      <Route exact path="/home" component={HomePage} />
      <Route exact path="/guests" component={GuestsPage} />
      <Route exact path="/reservations" component={ReservationsPage} />
      <Route exact path="/events" component={EventsPage} />
      <Route exact path="/venues" component={VenuesPage} />
      <Route exact path="/summary" component={SummaryPage} />
      <Route exact path="/"><Redirect to="/home" /></Route>
    </IonRouterOutlet>
    <IonTabBar slot="bottom">
      <IonTabButton tab="home" href="/home">
        <IonIcon icon={homeOutline} />
        <IonLabel>Home</IonLabel>
      </IonTabButton>
      <IonTabButton tab="guests" href="/guests">
        <IonIcon icon={peopleOutline} />
        <IonLabel>Guests</IonLabel>
      </IonTabButton>
      <IonTabButton tab="reservations" href="/reservations">
        <IonIcon icon={listOutline} />
        <IonLabel>Reservations</IonLabel>
      </IonTabButton>
      <IonTabButton tab="more" href="/events">
        <IonIcon icon={ellipsisHorizontal} />
        <IonLabel>More</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
);

const App: React.FC = () => {
  const { hydrated, onboarded, load, setOnboarded } = useAppStore((s) => ({
    hydrated: s.hydrated, onboarded: s.onboarded,
    load: s.load, setOnboarded: s.setOnboarded,
  }));

  useEffect(() => { load(); }, [load]);

  if (!hydrated) return <IonApp />;

  return (
    <IonApp>
      <IonReactRouter>
        <IonSplitPane contentId="main">
          <Drawer />
          <Tabs />
        </IonSplitPane>
        <ModalsHost />
        <OnboardingFlow open={!onboarded} onDone={() => setOnboarded(true)} />
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
