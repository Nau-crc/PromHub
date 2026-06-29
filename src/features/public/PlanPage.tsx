import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IonPage, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import {
  fetchToday, planRegister, planReserve,
  type PlanEvent, type PlanRegisterResult, type PlanReserveResult,
} from '@/services/shareApi';
import { NumberField } from '@/components/NumberField';
import { PlatformPicker } from '@/components/PlatformPicker';
import { PhotoUploader } from '@/components/PhotoUploader';
import { SelectField } from '@/components/SelectField';
import { COUNTRY_CODES } from '@/core/constants';
import {
  formatPhone, isValidPhone, maxDigits, onlyDigits, placeholderForCode,
} from '@/core/utils/phone';
import type { Platform } from '@/core/types';

// ─────────────────────────────────────────────────────────────
//  PlanPage — public landing for /plan(?d=YYYY-MM-DD).
//
//  Top-level mode chooser: TWO buttons.
//    - Invitación → InviteWizard (multi-event guest sign-up,
//      free; one guest row per picked event).
//    - Reserva    → ReserveWizard (paid VIP table at a single
//      venue; one reservation row per submit).
//
//  Both branches share the same `/api/v1/today` payload (events
//  happening tonight + venue + vipTypes + vipPrices) and the
//  same brand header. The wizards live as components inside this
//  file because they only mount inside the public bypass route
//  and don't get reused elsewhere.
// ─────────────────────────────────────────────────────────────

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'ready'; date: string; events: PlanEvent[] };

type Mode = 'choose' | 'invite' | 'reserve';

const isVideoUrl = (url: string) => /\.(mp4|mov|webm)(\?|$)/i.test(url);

export const PlanPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const dateParam = (search.get('d') ?? search.get('date') ?? '').trim();
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [mode, setMode] = useState<Mode>('choose');

  useEffect(() => {
    fetchToday(requestedDate)
      .then((r) => {
        setLoad(r.events.length
          ? { kind: 'ready', date: r.date, events: r.events }
          : { kind: 'not-found' });
      })
      .catch(() => setLoad({ kind: 'not-found' }));
  }, [requestedDate]);

  return (
    <IonPage>
      <IonContent>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 18px 32px' }}>
          {/* Brand header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 32, height: 32, background: '#1a1a1a', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#F97316', fontWeight: 700, fontSize: 12 }}>P</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>PromHub</span>
          </div>

          {load.kind === 'loading' && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {t('publicForm.loading')}
            </div>
          )}

          {load.kind === 'not-found' && (
            <div className="empty-box" style={{ margin: 0 }}>
              {t('plan.nothingTonight')}
            </div>
          )}

          {load.kind === 'ready' && mode === 'choose' && (
            <ModeChooser
              date={load.date}
              onPickInvite={() => setMode('invite')}
              onPickReserve={() => setMode('reserve')}
            />
          )}

          {load.kind === 'ready' && mode === 'invite' && (
            <InviteWizard
              date={load.date}
              events={load.events}
              onBack={() => setMode('choose')}
            />
          )}

          {load.kind === 'ready' && mode === 'reserve' && (
            <ReserveWizard
              date={load.date}
              events={load.events}
              onBack={() => setMode('choose')}
            />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

// ─────────────────────────────────────────────────────────────
//  ModeChooser — the new landing. Two big tappable cards. Title
//  + date sit above the cards so the guest always sees which
//  night she's about to sign up for.
// ─────────────────────────────────────────────────────────────

const ModeChooser: React.FC<{
  date: string;
  onPickInvite: () => void;
  onPickReserve: () => void;
}> = ({ date, onPickInvite, onPickReserve }) => {
  const { t } = useTranslation();
  const niceDate = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return (
    <>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{t('plan.title')}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 24, textTransform: 'capitalize' }}>
        {niceDate}
      </div>

      <button
        type="button"
        className="btn-primary"
        style={{ width: '100%', padding: '20px 16px', marginBottom: 12, fontSize: 16, fontWeight: 600 }}
        onClick={onPickInvite}
      >
        <div>{t('plan.modeInvite')}</div>
        <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>
          {t('plan.modeInviteHint')}
        </div>
      </button>

      <button
        type="button"
        className="btn-secondary"
        style={{ width: '100%', padding: '20px 16px', fontSize: 16, fontWeight: 600 }}
        onClick={onPickReserve}
      >
        <div>{t('plan.modeReserve')}</div>
        <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>
          {t('plan.modeReserveHint')}
        </div>
      </button>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
//  InviteWizard — the original /plan flow (free multi-event
//  sign-up). Kept structurally identical to the pre-mode-chooser
//  implementation. Only changes: it receives `date` and `events`
//  as props instead of fetching them itself, and there's a "back
//  to mode chooser" button on step 1.
// ─────────────────────────────────────────────────────────────

type InviteStep = 'timeslot' | 'venue' | 'terms' | 'info' | 'submitting' | 'done';

const InviteWizard: React.FC<{
  date: string;
  events: PlanEvent[];
  onBack: () => void;
}> = ({ date, events, onBack }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<InviteStep>('timeslot');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pickedTimeslotNames, setPickedTimeslotNames] = useState<string[]>([]);
  const [pickedEventIds, setPickedEventIds] = useState<number[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptFlyerStory, setAcceptFlyerStory] = useState(false);
  const [name, setName] = useState('');
  const [pax, setPax] = useState<number | null>(1);
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [igHandle, setIgHandle] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [results, setResults] = useState<PlanRegisterResult[]>([]);

  const timeslotNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ev of events) {
      for (const ts of ev.timeslots) {
        const k = ts.name.trim();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(k);
      }
    }
    return out;
  }, [events]);

  const venueOptions = useMemo(() => {
    const eligible = events.filter((ev) =>
      ev.timeslots.some((ts) => pickedTimeslotNames.includes(ts.name)),
    );
    type Group = { venueName: string; events: PlanEvent[] };
    const byVenue = new Map<string, Group>();
    for (const ev of eligible) {
      const key = ev.venueName ?? '__none__';
      const label = ev.venueName ?? t('plan.noVenue');
      const g = byVenue.get(key) ?? { venueName: label, events: [] };
      g.events.push(ev);
      byVenue.set(key, g);
    }
    return [...byVenue.values()];
  }, [events, pickedTimeslotNames, t]);

  const pickedEvents = useMemo(
    () => events.filter((ev) => pickedEventIds.includes(ev.id)),
    [events, pickedEventIds],
  );

  const requiredPhotoCount = useMemo(
    () => pickedEvents.reduce((acc, ev) => Math.max(acc, ev.photoCount ?? 0), 0),
    [pickedEvents],
  );

  const toggleTimeslot = (name: string) =>
    setPickedTimeslotNames((arr) =>
      arr.includes(name) ? arr.filter((x) => x !== name) : [...arr, name]);
  const toggleEvent = (id: number) =>
    setPickedEventIds((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const goVenue = () => {
    setPickedEventIds((arr) => arr.filter((id) => {
      const ev = events.find((e) => e.id === id);
      return ev?.timeslots.some((ts) => pickedTimeslotNames.includes(ts.name));
    }));
    setStep('venue');
  };

  const submit = async () => {
    setErrorMsg(null);
    if (!name.trim()) { setErrorMsg(t('publicForm.nameRequired')); return; }
    if (requiredPhotoCount > 0 && photos.length < requiredPhotoCount) {
      setErrorMsg(t('publicForm.photosRequired', { count: requiredPhotoCount }));
      return;
    }
    setStep('submitting');
    try {
      const resp = await planRegister({
        date,
        eventIds: pickedEventIds,
        name: name.trim(),
        pax: pax ?? 1,
        igHandle: igHandle.trim().replace(/^@+/, ''),
        igPlatform: platform,
        photos,
        acceptedTerms: true,
        acceptedFlyerStory: true,
      });
      setResults(resp.results);
      setStep('done');
      const uniqueFlyers = [...new Set(
        resp.results.map((r) => r.flyerUrl).filter((u): u is string => !!u),
      )];
      for (const url of uniqueFlyers) {
        triggerDownload(url);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStep('info');
    }
  };

  const niceDate = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{t('plan.title')}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 22, textTransform: 'capitalize' }}>
        {niceDate}
      </div>

      {step === 'timeslot' && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{t('plan.q1')}</div>
          <div className="chip-picker" style={{ marginBottom: 16 }}>
            {timeslotNames.map((name) => (
              <div
                key={name}
                className={`chip ${pickedTimeslotNames.includes(name) ? 'sel' : ''}`}
                onClick={() => toggleTimeslot(name)}
              >
                {name}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 14, fontSize: 15 }} onClick={onBack}>
              {t('plan.back')}
            </button>
            <button
              className="btn-primary"
              style={{ flex: 2, padding: 14, fontSize: 15 }}
              onClick={goVenue}
              disabled={!pickedTimeslotNames.length}
            >
              {t('plan.continue')}
            </button>
          </div>
        </>
      )}

      {step === 'venue' && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            {t('plan.q2', { slots: pickedTimeslotNames.join(' / ') })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
            {t('plan.q2Hint')}
          </div>
          {venueOptions.map((group) => (
            <div key={group.venueName} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6,
              }}>{group.venueName}</div>
              {group.events.map((ev) => {
                const slots = ev.timeslots.map((t) => t.name).join(' · ');
                const on = pickedEventIds.includes(ev.id);
                return (
                  <div
                    key={ev.id}
                    className={`event-picker-item ${on ? 'sel' : ''}`}
                    onClick={() => toggleEvent(ev.id)}
                  >
                    <div className="event-picker-info">
                      <div className="event-picker-name">{ev.name}</div>
                      <div className="event-picker-sub">{slots}</div>
                    </div>
                    <div className="event-picker-check">{on ? '✓' : ''}</div>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 14, fontSize: 15 }} onClick={() => setStep('timeslot')}>
              {t('plan.back')}
            </button>
            <button
              className="btn-primary"
              style={{ flex: 2, padding: 14, fontSize: 15 }}
              onClick={() => setStep('terms')}
              disabled={!pickedEventIds.length}
            >
              {t('plan.continue')}
            </button>
          </div>
        </>
      )}

      {step === 'terms' && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{t('plan.termsTitle')}</div>
          {pickedEvents.map((ev) => (
            <div key={ev.id} style={{
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-md)',
              padding: '12px 14px',
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {ev.name} {ev.venueName ? <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>· {ev.venueName}</span> : null}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                {ev.description.trim() || t('plan.noConditions')}
              </div>
            </div>
          ))}

          <label htmlFor="acc1" style={checkRowStyle}>
            <input id="acc1" type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>{t('plan.acceptTerms')}</span>
          </label>
          <label htmlFor="acc2" style={checkRowStyle}>
            <input id="acc2" type="checkbox" checked={acceptFlyerStory} onChange={(e) => setAcceptFlyerStory(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>{t('plan.acceptFlyerStory')}</span>
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 14, fontSize: 15 }} onClick={() => setStep('venue')}>
              {t('plan.back')}
            </button>
            <button
              className="btn-primary"
              style={{ flex: 2, padding: 14, fontSize: 15 }}
              onClick={() => setStep('info')}
              disabled={!acceptTerms || !acceptFlyerStory}
            >
              {t('plan.continue')}
            </button>
          </div>
        </>
      )}

      {(step === 'info' || step === 'submitting') && (
        <>
          <div className="form-group">
            <label className="form-label">{t('publicForm.yourName')}</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('publicForm.namePlaceholder')} autoComplete="name" />
          </div>
          <div className="form-group">
            <label className="form-label">{t('publicForm.howMany')}</label>
            <NumberField className="form-input" min={1} max={20} value={pax} onChange={setPax} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('publicForm.socials')}</label>
            <PlatformPicker value={platform} onChange={setPlatform} />
            <input
              className="form-input"
              value={igHandle}
              onChange={(e) => setIgHandle(e.target.value)}
              placeholder={t('publicForm.handlePlaceholder')}
              autoComplete="off" autoCapitalize="off"
            />
          </div>
          {requiredPhotoCount > 0 && (
            <div className="form-group">
              <label className="form-label">{t('publicForm.photos', { count: requiredPhotoCount })}</label>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
                {t('publicForm.photosHint', { count: requiredPhotoCount })}
              </div>
              <PhotoUploader count={requiredPhotoCount} value={photos} onChange={setPhotos} />
            </div>
          )}
          {errorMsg && (
            <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 10 }}>⚠︎ {errorMsg}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 14, fontSize: 15 }} onClick={() => setStep('terms')} disabled={step === 'submitting'}>
              {t('plan.back')}
            </button>
            <button className="btn-primary" style={{ flex: 2, padding: 14, fontSize: 15 }} onClick={submit} disabled={step === 'submitting'}>
              {step === 'submitting' ? t('publicForm.submitting') : t('plan.signMeUp')}
            </button>
          </div>
        </>
      )}

      {step === 'done' && (
        <>
          <div style={{
            margin: '24px auto 16px', width: 70, height: 70,
            background: '#EAF3DE', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>{t('plan.doneTitle')}</div>
          {results.map((r) => (
            <div key={r.eventId} style={{
              background: r.waitlisted ? '#FFF4D6' : 'var(--color-background-secondary)',
              border: r.waitlisted ? '1px solid #E5A100' : '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-md)',
              padding: '12px 14px',
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{r.eventName}</div>
              {r.waitlisted ? (
                <div style={{ fontSize: 12, color: '#8A5A00' }}>{t('plan.waitlisted', { position: r.queuePosition ?? '?' })}</div>
              ) : (
                <div style={{ fontSize: 12, color: '#0F6E56' }}>✓ {t('plan.confirmed')}</div>
              )}
              {r.flyerUrl && (
                <div style={{ marginTop: 8 }}>
                  {isVideoUrl(r.flyerUrl)
                    ? <video src={r.flyerUrl} controls style={{ width: '100%', borderRadius: 8 }} />
                    : <img src={r.flyerUrl} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />}
                  <button className="btn-secondary" style={{ width: '100%', marginTop: 8, padding: 10, fontSize: 13 }} onClick={() => triggerDownload(r.flyerUrl!)}>
                    {t('plan.downloadFlyer')}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
            {t('plan.flyerReminder')}
          </div>
        </>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
//  ReserveWizard — paid VIP-table flow. One venue, one VIP type,
//  one submission. Renders only venues that have at least one
//  event tonight with vipTypes configured. Price comes from the
//  event's vipPrices for the picked VIP type name.
// ─────────────────────────────────────────────────────────────

type ReserveStep = 'venue' | 'table' | 'info' | 'submitting' | 'done';

interface ReserveCandidate {
  venueId: number;
  venueName: string;
  /** The event the price + occurrence comes from. We pick the
   *  first event at the venue tonight; if the promoter has more
   *  than one, the table picker still works as long as the VIP
   *  type name matches. */
  event: PlanEvent;
}

const ReserveWizard: React.FC<{
  date: string;
  events: PlanEvent[];
  onBack: () => void;
}> = ({ date, events, onBack }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<ReserveStep>('venue');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [venueId, setVenueId] = useState<number | null>(null);
  const [vipTypeName, setVipTypeName] = useState<string>('');
  const [pax, setPax] = useState<number | null>(2);
  const [name, setName] = useState('');
  const [phoneCode, setPhoneCode] = useState<string>('+34');
  const [phoneNum, setPhoneNum] = useState<string>('');
  const [time, setTime] = useState<string>('20:00');
  const [result, setResult] = useState<PlanReserveResult | null>(null);

  // Eligible venues = those with an event tonight that has at
  // least one VIP type on the venue. We dedupe on venueId so the
  // user picks a place, not an event.
  const candidates = useMemo<ReserveCandidate[]>(() => {
    const byVenue = new Map<number, ReserveCandidate>();
    for (const ev of events) {
      if (ev.venueId == null || !ev.venueName) continue;
      if (!ev.venueVipTypes.length) continue;
      if (!byVenue.has(ev.venueId)) {
        byVenue.set(ev.venueId, {
          venueId: ev.venueId,
          venueName: ev.venueName,
          event: ev,
        });
      }
    }
    return [...byVenue.values()];
  }, [events]);

  const chosen = useMemo(
    () => candidates.find((c) => c.venueId === venueId) ?? null,
    [candidates, venueId],
  );

  const vipDef = useMemo(
    () => chosen?.event.venueVipTypes.find((vt) => vt.name === vipTypeName) ?? null,
    [chosen, vipTypeName],
  );

  const priceForChosen = useMemo(
    () => (chosen && vipTypeName ? chosen.event.vipPrices[vipTypeName] ?? null : null),
    [chosen, vipTypeName],
  );

  // Keep pax inside the picked VIP type's range. When the user
  // bumps into the limits we clamp silently rather than blocking
  // the field — the submit check catches anything out of range.
  useEffect(() => {
    if (!vipDef) return;
    setPax((p) => {
      const n = p ?? vipDef.minPax;
      if (n < vipDef.minPax) return vipDef.minPax;
      if (n > vipDef.maxPax) return vipDef.maxPax;
      return n;
    });
  }, [vipDef]);

  const phoneDigits = onlyDigits(phoneNum);
  const phoneOk = !!phoneDigits && isValidPhone(phoneCode, phoneDigits);

  const submit = async () => {
    setErrorMsg(null);
    if (!chosen || !vipDef) { setErrorMsg(t('plan.reserveErrPick')); return; }
    if (!name.trim()) { setErrorMsg(t('publicForm.nameRequired')); return; }
    if (!phoneOk) {
      setErrorMsg(t('plan.reserveErrPhone', { code: phoneCode, example: placeholderForCode(phoneCode) }));
      return;
    }
    if (!pax || pax < vipDef.minPax || pax > vipDef.maxPax) {
      setErrorMsg(t('plan.reserveErrPax', { min: vipDef.minPax, max: vipDef.maxPax }));
      return;
    }
    setStep('submitting');
    try {
      const resp = await planReserve({
        date,
        venueId: chosen.venueId,
        eventId: chosen.event.id,
        vipType: vipTypeName,
        pax,
        name: name.trim(),
        phoneCode,
        phoneNum: phoneNum.trim(),
        time,
      });
      setResult(resp);
      setStep('done');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStep('info');
    }
  };

  const niceDate = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  if (candidates.length === 0) {
    return (
      <>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{t('plan.reserveTitle')}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 22, textTransform: 'capitalize' }}>
          {niceDate}
        </div>
        <div className="empty-box" style={{ margin: 0 }}>
          {t('plan.reserveNoVenues')}
        </div>
        <button className="btn-secondary" style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 14 }} onClick={onBack}>
          {t('plan.back')}
        </button>
      </>
    );
  }

  return (
    <>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{t('plan.reserveTitle')}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 22, textTransform: 'capitalize' }}>
        {niceDate}
      </div>

      {step === 'venue' && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{t('plan.reserveQ1')}</div>
          {candidates.map((c) => {
            const on = venueId === c.venueId;
            const tableCount = c.event.venueVipTypes.length;
            return (
              <div
                key={c.venueId}
                className={`event-picker-item ${on ? 'sel' : ''}`}
                onClick={() => { setVenueId(c.venueId); setVipTypeName(''); }}
              >
                <div className="event-picker-info">
                  <div className="event-picker-name">{c.venueName}</div>
                  <div className="event-picker-sub">
                    {t('plan.reserveVipCount', { count: tableCount })}
                  </div>
                </div>
                <div className="event-picker-check">{on ? '✓' : ''}</div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 14, fontSize: 15 }} onClick={onBack}>
              {t('plan.back')}
            </button>
            <button
              className="btn-primary"
              style={{ flex: 2, padding: 14, fontSize: 15 }}
              onClick={() => setStep('table')}
              disabled={venueId == null}
            >
              {t('plan.continue')}
            </button>
          </div>
        </>
      )}

      {step === 'table' && chosen && (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>
            {t('plan.reserveQ2', { venue: chosen.venueName })}
          </div>
          {chosen.event.venueVipTypes.map((vt) => {
            const on = vipTypeName === vt.name;
            const price = chosen.event.vipPrices[vt.name];
            return (
              <div
                key={vt.id}
                className={`event-picker-item ${on ? 'sel' : ''}`}
                onClick={() => setVipTypeName(vt.name)}
              >
                <div className="event-picker-info">
                  <div className="event-picker-name">{vt.name}</div>
                  <div className="event-picker-sub">
                    {t('plan.reservePaxRange', { min: vt.minPax, max: vt.maxPax })}
                    {price != null && (
                      <> · <strong style={{ color: 'var(--color-text-primary)' }}>€{Number(price).toFixed(2)}</strong></>
                    )}
                  </div>
                </div>
                <div className="event-picker-check">{on ? '✓' : ''}</div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 14, fontSize: 15 }} onClick={() => setStep('venue')}>
              {t('plan.back')}
            </button>
            <button
              className="btn-primary"
              style={{ flex: 2, padding: 14, fontSize: 15 }}
              onClick={() => setStep('info')}
              disabled={!vipTypeName}
            >
              {t('plan.continue')}
            </button>
          </div>
        </>
      )}

      {(step === 'info' || step === 'submitting') && chosen && vipDef && (
        <>
          {/* Recap card so the guest sees what she's confirming. */}
          <div style={{
            background: 'var(--color-background-secondary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-md)',
            padding: '12px 14px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{chosen.venueName}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {vipTypeName}
              {priceForChosen != null && <> · €{Number(priceForChosen).toFixed(2)}</>}
              {' · '}
              {t('plan.reservePaxRange', { min: vipDef.minPax, max: vipDef.maxPax })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('publicForm.yourName')}</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('publicForm.namePlaceholder')} autoComplete="name" />
          </div>

          <div className="form-group">
            <label className="form-label">{t('plan.reservePhone')}</label>
            <div className="phone-row">
              <SelectField
                value={phoneCode}
                onChange={(code) => {
                  setPhoneCode(code);
                  const limited = onlyDigits(phoneNum).slice(0, maxDigits(code));
                  setPhoneNum(formatPhone(code, limited));
                }}
                title={t('venueForm.countryCode')}
                style={{ minWidth: 110, flexShrink: 0 }}
                options={COUNTRY_CODES.map((c) => ({ value: c.code, label: `${c.flag} ${c.code}` }))}
              />
              <input
                className="form-input"
                type="tel" inputMode="numeric" autoComplete="tel-national"
                placeholder={placeholderForCode(phoneCode)}
                value={phoneNum}
                onChange={(e) => {
                  const limited = onlyDigits(e.target.value).slice(0, maxDigits(phoneCode));
                  setPhoneNum(formatPhone(phoneCode, limited));
                }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('publicForm.howMany')}</label>
              <NumberField className="form-input" min={vipDef.minPax} max={vipDef.maxPax} value={pax} onChange={setPax} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('plan.reserveTime')}</label>
              <input className="form-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          {errorMsg && (
            <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 10 }}>⚠︎ {errorMsg}</div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 14, fontSize: 15 }} onClick={() => setStep('table')} disabled={step === 'submitting'}>
              {t('plan.back')}
            </button>
            <button className="btn-primary" style={{ flex: 2, padding: 14, fontSize: 15 }} onClick={submit} disabled={step === 'submitting'}>
              {step === 'submitting' ? t('publicForm.submitting') : t('plan.reserveCta')}
            </button>
          </div>
        </>
      )}

      {step === 'done' && result && (
        <>
          <div style={{
            margin: '24px auto 16px', width: 70, height: 70,
            background: '#EAF3DE', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>{t('plan.reserveDoneTitle')}</div>
          <div style={{
            background: 'var(--color-background-secondary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-md)',
            padding: '14px 16px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{result.venueName}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
              {result.vipType} · {t('plan.reservePax', { count: result.pax })}<br />
              {t('plan.reserveTime')}: <strong>{result.time}</strong>
              {result.priceAtBooking != null && (
                <><br />{t('plan.reservePrice')}: <strong style={{ color: 'var(--color-text-primary)' }}>€{Number(result.priceAtBooking).toFixed(2)}</strong></>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
            {t('plan.reservePayAtVenue')}
          </div>
        </>
      )}
    </>
  );
};

// ─── helpers ─────────────────────────────────────────────────

const checkRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: '12px 14px',
  border: '1px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-md)',
  cursor: 'pointer',
  marginBottom: 10,
};

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
