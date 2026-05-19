import React, { useEffect } from 'react';
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
  sunnyOutline, moonOutline, contrastOutline,
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
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { useThemeStore, type ThemeChoice } from '@/store/useThemeStore';
import { useLocaleStore, type LocaleChoice } from '@/store/useLocaleStore';
import { useTranslation } from 'react-i18next';

setupIonicReact({ mode: 'ios' });

const ThemeToggle: React.FC = () => {
  const { t } = useTranslation();
  const { choice, set } = useThemeStore((s) => ({ choice: s.choice, set: s.set }));
  const opts: { value: ThemeChoice; icon: string; labelKey: string }[] = [
    { value: 'light', icon: sunnyOutline, labelKey: 'drawer.light' },
    { value: 'dark', icon: moonOutline, labelKey: 'drawer.dark' },
    { value: 'system', icon: contrastOutline, labelKey: 'drawer.auto' },
  ];
  return (
    <div style={{
      borderTop: '0.5px solid var(--color-border-tertiary)',
      padding: '12px 16px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)',
        textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
      }}>{t('drawer.appearance')}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`tog-btn ${choice === o.value ? 'on' : ''}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => set(o.value)}
          >
            <IonIcon icon={o.icon} style={{ fontSize: 14 }} />
            {t(o.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
};

// Language picker — sits below ThemeToggle in the drawer footer.
// 'Auto' follows the OS/browser language at startup; explicit values
// override and persist via Capacitor Preferences.
const LanguageToggle: React.FC = () => {
  const { t } = useTranslation();
  const { choice, set } = useLocaleStore((s) => ({ choice: s.choice, set: s.set }));
  const opts: { value: LocaleChoice; label: string }[] = [
    { value: 'auto', label: t('drawer.auto') },
    { value: 'en', label: 'EN' },
    { value: 'es', label: 'ES' },
    { value: 'ca', label: 'CA' },
  ];
  return (
    <div style={{
      borderTop: '0.5px solid var(--color-border-tertiary)',
      padding: '12px 16px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)',
        textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
      }}>{t('drawer.language')}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`tog-btn ${choice === o.value ? 'on' : ''}`}
            style={{ flex: 1 }}
            onClick={() => set(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const Drawer: React.FC = () => {
  const open = useUIStore((s) => s.open);
  const { t } = useTranslation();
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

        <ThemeToggle />
        <LanguageToggle />
      </IonContent>
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
