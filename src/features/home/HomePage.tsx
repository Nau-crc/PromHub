import React, { useMemo, useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonIcon } from '@ionic/react';
import { chevronBackOutline, chevronForwardOutline, shareSocialOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { today } from '@/core/constants';
import { fmtDateLong, isoDay } from '@/core/utils/date';
import { occurs } from '@/features/summary/calculations';
import { EventCard } from '@/components/EventCard';
import { EmptyBox } from '@/components/EmptyBox';
import { buildPlanUrl } from '@/services/shareApi';
// CloseNightPanel moved out of Home — lives in the drawer footer now.

export const HomePage: React.FC = () => {
  const events = useAppStore((s) => s.events);
  const open = useUIStore((s) => s.open);
  const { t } = useTranslation();

  // Day cursor. Defaults to today; the promoter can step forward
  // (or back) to peek at future nights. The share button below
  // always reflects whichever day is currently in view.
  const [viewIso, setViewIso] = useState<string>(isoDay(today()));
  const viewDate = useMemo(() => new Date(viewIso + 'T00:00:00'), [viewIso]);

  // Step one day at a time using a local Date — avoids timezone
  // drift you'd get from arithmetic on the ISO string.
  const shiftDay = (delta: number) => {
    const next = new Date(viewDate);
    next.setDate(next.getDate() + delta);
    setViewIso(isoDay(next));
  };
  const todayIso = isoDay(today());
  const isToday = viewIso === todayIso;
  // Block stepping into the past — there's no reason to share a
  // registration link for a night that's already happened.
  const canStepBack = viewIso > todayIso;

  const dayEvents = useMemo(
    () => events.filter((e) => occurs(e, viewIso)),
    [events, viewIso],
  );

  // Copy the /plan link for the day in view. We try the native
  // share sheet first on mobile, fall back to clipboard.
  const [feedback, setFeedback] = useState<string | null>(null);
  const sharePlanLink = async () => {
    const url = buildPlanUrl(viewIso);
    const flash = (msg: string) => {
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 2500);
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'PromHub', url });
        return;
      } catch { /* user cancelled — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash(t('home.shareCopied'));
    } catch {
      flash(url);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  aria-label={t('home.prevDay')}
                  onClick={() => shiftDay(-1)}
                  disabled={!canStepBack}
                  style={dayNavBtnStyle(!canStepBack)}
                >
                  <IonIcon icon={chevronBackOutline} style={{ fontSize: 18 }} />
                </button>
                <div>
                  <div className="page-title">{fmtDateLong(viewDate)}</div>
                  <div className="page-sub">{isToday ? t('home.subtitle') : t('home.subtitleFuture')}</div>
                </div>
                <button
                  type="button"
                  aria-label={t('home.nextDay')}
                  onClick={() => shiftDay(1)}
                  style={dayNavBtnStyle(false)}
                >
                  <IonIcon icon={chevronForwardOutline} style={{ fontSize: 18 }} />
                </button>
              </div>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => open('addEvent')}
              >
                {t('home.addBtn')}
              </button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Share the public /plan link for the day in view. Lives
            above all event cards so the promoter never has to dig
            into an individual event to hand out the registration
            link. The button is icon-only on purpose — no preview
            URL, no refresh-submissions action. */}
        <div style={{ padding: '12px 16px 0' }}>
          <button
            type="button"
            className="btn-primary"
            style={{
              width: '100%', padding: '12px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 14, fontWeight: 600,
            }}
            onClick={sharePlanLink}
          >
            <IonIcon icon={shareSocialOutline} style={{ fontSize: 16 }} />
            {t('home.sharePlanLink')}
          </button>
          {feedback && (
            <div style={{
              fontSize: 11, color: 'var(--color-text-secondary)',
              marginTop: 6, textAlign: 'center',
            }}>
              {feedback}
            </div>
          )}
        </div>

        <div className="spacer" />
        {dayEvents.length ? dayEvents.map((e) => (
          <EventCard key={e.id} event={e} occurrenceDate={viewIso} onClick={() => open('eventDetail', { id: e.id })} />
        )) : (
          <EmptyBox>
            {isToday ? t('home.empty') : t('home.emptyDay')}<br />
            {isToday ? t('home.emptySub') : t('home.emptyDaySub')}
          </EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};

const dayNavBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: 28, height: 28, borderRadius: '50%',
  background: 'transparent',
  border: '0.5px solid var(--color-border-tertiary)',
  color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.4 : 1,
  padding: 0,
});
