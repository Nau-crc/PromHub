import React, { useEffect, useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp, IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon,
  IonMenu, IonHeader, IonToolbar, IonContent, IonList, IonItem,
  IonSplitPane, IonTitle, setupIonicReact, IonMenuToggle,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  homeOutline, peopleOutline, listOutline,
  calendarOutline, businessOutline, statsChartOutline, addOutline,
  settingsOutline,
} from 'ionicons/icons';

import { HomePage } from '@/features/home/HomePage';
import { GuestsPage } from '@/features/guests/GuestsPage';
import { ReservationsPage } from '@/features/reservations/ReservationsPage';
import { EventsPage } from '@/features/events/EventsPage';
import { VenuesPage } from '@/features/venues/VenuesPage';
import { SummaryPage } from '@/features/summary/SummaryPage';
import { PublicRegistrationPage } from '@/features/public/PublicRegistrationPage';
import { Switch, useLocation } from 'react-router-dom';

import { ModalsHost } from '@/features/ModalsHost';
import { ConfirmHost } from '@/components/ConfirmHost';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { CloseNightPanel } from '@/features/nightClose/CloseNightPanel';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { today } from '@/core/constants';
import { isoDay } from '@/core/utils/date';
import { useTranslation } from 'react-i18next';

setupIonicReact({ mode: 'ios' });

const Drawer: React.FC = () => {
  const open = useUIStore((s) => s.open);
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        {/* Flex column: nav items grow, footer block pinned to the
            bottom of the viewport. The wrapper's `minHeight: 100%`
            ensures the column fills the IonContent so `marginTop:
            auto` on the footer behaves predictably. */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          minHeight: '100%',
        }}>
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ padding: '14px 20px 4px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t('drawer.manage')}
            </div>
            <IonList lines="full">
              <IonMenuToggle autoHide={false}>
                <IonItem button routerLink="/events" detail>
                  <IonIcon slot="start" icon={calendarOutline} />
                  <IonLabel>
                    <h3>{t('drawer.events')}</h3>
                  </IonLabel>
                </IonItem>
                <IonItem button routerLink="/venues" detail>
                  <IonIcon slot="start" icon={businessOutline} />
                  <IonLabel>
                    <h3>{t('drawer.venues')}</h3>
                  </IonLabel>
                </IonItem>
                <IonItem button routerLink="/summary" detail>
                  <IonIcon slot="start" icon={statsChartOutline} />
                  <IonLabel>
                    <h3>{t('drawer.summary')}</h3>
                  </IonLabel>
                </IonItem>
              </IonMenuToggle>
            </IonList>

            <div style={{ padding: '14px 20px 4px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t('drawer.quickAdd')}
            </div>
            <IonList lines="full">
              <IonMenuToggle autoHide={false}>
                <IonItem button onClick={() => open('addEvent')}>
                  <IonIcon slot="start" icon={addOutline} color="primary" />
                  <IonLabel><h3>{t('drawer.newEvent')}</h3></IonLabel>
                </IonItem>
                <IonItem button onClick={() => open('addVenue')}>
                  <IonIcon slot="start" icon={addOutline} color="primary" />
                  <IonLabel><h3>{t('drawer.newVenue')}</h3></IonLabel>
                </IonItem>
              </IonMenuToggle>
            </IonList>
          </div>

          {/* Spacer eats any remaining vertical space so the footer
              block below it stays glued to the viewport bottom even
              when the drawer is taller than the nav content. */}
          <div style={{ flex: '1 1 auto' }} />

          {/* Footer block: Close night → ⚙ Settings → Copyright.
              Appearance + Language used to live here as inline
              toggles; both moved into SettingsModal so the gear has
              one home for every promoter preference. */}
          <div style={{
            flex: '0 0 auto',
            borderTop: '0.5px solid var(--color-border-tertiary)',
            paddingBottom: 12,
          }}>
            <div style={{ padding: '12px 16px 0' }}>
              <CloseNightPanel isoDate={isoDay(today())} />
            </div>
            <div style={{
              borderTop: '0.5px solid var(--color-border-tertiary)',
              marginTop: 12,
            }}>
              <IonItem button detail={false} onClick={() => setSettingsOpen(true)}>
                <IonIcon slot="start" icon={settingsOutline} />
                <IonLabel><h3>{t('settings.title')}</h3></IonLabel>
              </IonItem>
            </div>
            <div style={{
              padding: '10px 20px 6px',
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--color-text-secondary)',
            }}>
              © 2026 Nau-crc
            </div>
          </div>
        </div>
      </IonContent>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </IonMenu>
  );
};

const Tabs: React.FC = () => {
  const { t } = useTranslation();
  return (
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
          <IonLabel>{t('nav.home')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="guests" href="/guests">
          <IonIcon icon={peopleOutline} />
          <IonLabel>{t('nav.guests')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="reservations" href="/reservations">
          <IonIcon icon={listOutline} />
          <IonLabel>{t('nav.reservations')}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

const App: React.FC = () => {
  const { hydrated, onboarded, load, setOnboarded } = useAppStore((s) => ({
    hydrated: s.hydrated, onboarded: s.onboarded,
    load: s.load, setOnboarded: s.setOnboarded,
  }));
  const loadTheme = useThemeStore((s) => s.load);
  const loadLocale = useLocaleStore((s) => s.load);

  useEffect(() => {
    load();
    loadTheme();
    loadLocale();
  }, [load, loadTheme, loadLocale]);

  if (!hydrated) return <IonApp />;

  return (
    <IonApp>
      <IonReactRouter>
        <AppRouter onboarded={onboarded} onOnboard={() => setOnboarded(true)} />
      </IonReactRouter>
    </IonApp>
  );
};

// Top-level router. The /register/:token path bypasses the entire
// promoter shell (no drawer, no tabs, no onboarding) so a public
// guest can fill the form on a device that has never opened the app.
const AppRouter: React.FC<{ onboarded: boolean; onOnboard: () => void }> = ({
  onboarded, onOnboard,
}) => {
  const location = useLocation();
  const isPublicRoute = location.pathname.startsWith('/register/');

  if (isPublicRoute) {
    return (
      <Switch>
        <Route exact path="/register/:token" component={PublicRegistrationPage} />
      </Switch>
    );
  }

  return (
    <>
      <IonSplitPane contentId="main">
        <Drawer />
        <Tabs />
      </IonSplitPane>
      <ModalsHost />
      <ConfirmHost />
      <OnboardingFlow open={!onboarded} onDone={onOnboard} />
    </>
  );
};

export default App;
