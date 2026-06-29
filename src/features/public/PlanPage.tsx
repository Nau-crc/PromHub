import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IonPage, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import {
  fetchToday, planRegister,
  type PlanEvent, type PlanRegisterResult,
} from '@/services/shareApi';
import { NumberField } from '@/components/NumberField';
import { PlatformPicker } from '@/components/PlatformPicker';
import { PhotoUploader } from '@/components/PhotoUploader';
import type { Platform } from '@/core/types';

// ─────────────────────────────────────────────────────────────
//  PlanPage — public, multi-event sign-up flow.
//
//  Mounted at /plan(?d=YYYY-MM-DD). Replaces the per-event
//  /register/:token flow as the primary entry point for guests.
//  Old links still work via the legacy page; this is the new flow
//  the promoter shares each night.
//
//  Steps:
//    1. "Arma tu plan" — pick one or more timeslot names from the
//       union of every event's timeslots tonight.
//    2. For each picked timeslot, pick venues. Each pick resolves
//       to a specific event id (events are identified by venue
//       + timeslot for the chosen date).
//    3. Terms gate — show every picked event's description and
//       require TWO explicit checkboxes (event conditions +
//       commitment to re-post the flyer on her IG story).
//    4. Personal info (name, pax, socials) + photo upload section
//       when any picked event has `photoCount` set.
//    5. Submit → /api/v1/plan-register inserts N guest rows in
//       one call and returns each event's outcome (confirmed vs
//       waitlist position) + its flyerUrl. We trigger a download
//       per unique flyer immediately.
// ─────────────────────────────────────────────────────────────

type Step = 'loading' | 'timeslot' | 'venue' | 'terms' | 'info' | 'submitting' | 'done' | 'not-found';

const isVideoUrl = (url: string) => /\.(mp4|mov|webm)(\?|$)/i.test(url);

export const PlanPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const dateParam = (search.get('d') ?? search.get('date') ?? '').trim();
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  const [step, setStep] = useState<Step>('loading');
  const [date, setDate] = useState<string>('');
  const [events, setEvents] = useState<PlanEvent[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Picks
  const [pickedTimeslotNames, setPickedTimeslotNames] = useState<string[]>([]);
  const [pickedEventIds, setPickedEventIds] = useState<number[]>([]);

  // Terms
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptFlyerStory, setAcceptFlyerStory] = useState(false);

  // Info
  const [name, setName] = useState('');
  const [pax, setPax] = useState<number | null>(1);
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [igHandle, setIgHandle] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // Result
  const [results, setResults] = useState<PlanRegisterResult[]>([]);

  useEffect(() => {
    fetchToday(requestedDate)
      .then((r) => {
        setDate(r.date);
        setEvents(r.events);
        setStep(r.events.length ? 'timeslot' : 'not-found');
      })
      .catch(() => setStep('not-found'));
  }, [requestedDate]);

  // ── Derived ────────────────────────────────────────────────
  //
  // Step 1's options: every distinct timeslot NAME across tonight's
  // events. Same name from different events folds into one chip —
  // "Cena" at venue A and venue B is the same activity from the
  // guest's POV.
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

  // Step 2's options: every event whose timeslots include AT LEAST
  // ONE picked timeslot name. We group by venue for display but
  // record the resolved event id directly.
  const venueOptions = useMemo(() => {
    const eligible = events.filter((ev) =>
      ev.timeslots.some((ts) => pickedTimeslotNames.includes(ts.name)),
    );
    // Group by venueName (events without a venue cluster under "—")
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

  // Resolved events the guest has picked (step 2 result).
  const pickedEvents = useMemo(
    () => events.filter((ev) => pickedEventIds.includes(ev.id)),
    [events, pickedEventIds],
  );

  // Aggregate photo requirement across picks. We always require the
  // MAX across selected events — that way each event's door check
  // is satisfied with the same set of photos.
  const requiredPhotoCount = useMemo(
    () => pickedEvents.reduce(
      (acc, ev) => Math.max(acc, ev.photoCount ?? 0),
      0,
    ),
    [pickedEvents],
  );

  // ── Step transitions ───────────────────────────────────────
  const toggleTimeslot = (name: string) =>
    setPickedTimeslotNames((arr) =>
      arr.includes(name) ? arr.filter((x) => x !== name) : [...arr, name],
    );

  const toggleEvent = (id: number) =>
    setPickedEventIds((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
    );

  const goVenue = () => {
    // When the user moves on from step 1, drop any event picks that
    // no longer match the chosen timeslots — keeps state consistent
    // if she backs up and edits.
    setPickedEventIds((arr) => arr.filter((id) => {
      const ev = events.find((e) => e.id === id);
      return ev?.timeslots.some((ts) => pickedTimeslotNames.includes(ts.name));
    }));
    setStep('venue');
  };
  const goTerms = () => setStep('terms');
  const goInfo = () => setStep('info');

  // ── Submit ─────────────────────────────────────────────────
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
      // Auto-trigger flyer downloads. We sequence them so mobile
      // browsers that block bulk downloads still get at least one
      // through. Some browsers will still prompt — that's fine,
      // there's a manual "Download" button on the done screen too.
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

  // ── Render ────────────────────────────────────────────────
  const niceDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : '';

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

          {step === 'loading' && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {t('publicForm.loading')}
            </div>
          )}

          {step === 'not-found' && (
            <div className="empty-box" style={{ margin: 0 }}>
              {t('plan.nothingTonight')}
            </div>
          )}

          {(step === 'timeslot' || step === 'venue' || step === 'terms' || step === 'info' || step === 'submitting') && (
            <>
              {/* Title + date */}
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{t('plan.title')}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 22, textTransform: 'capitalize' }}>
                {niceDate}
              </div>
            </>
          )}

          {/* ── Step 1: timeslot picker ────────────────────── */}
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
              <button
                className="btn-primary"
                style={{ width: '100%', padding: 14, fontSize: 15 }}
                onClick={goVenue}
                disabled={!pickedTimeslotNames.length}
              >
                {t('plan.continue')}
              </button>
            </>
          )}

          {/* ── Step 2: venue picker per timeslot ──────────── */}
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
                <button
                  className="btn-secondary"
                  style={{ flex: 1, padding: 14, fontSize: 15 }}
                  onClick={() => setStep('timeslot')}
                >
                  {t('plan.back')}
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 2, padding: 14, fontSize: 15 }}
                  onClick={goTerms}
                  disabled={!pickedEventIds.length}
                >
                  {t('plan.continue')}
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: terms + IG story checkbox ──────────── */}
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
                <input
                  id="acc1"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {t('plan.acceptTerms')}
                </span>
              </label>

              <label htmlFor="acc2" style={checkRowStyle}>
                <input
                  id="acc2"
                  type="checkbox"
                  checked={acceptFlyerStory}
                  onChange={(e) => setAcceptFlyerStory(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {t('plan.acceptFlyerStory')}
                </span>
              </label>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1, padding: 14, fontSize: 15 }}
                  onClick={() => setStep('venue')}
                >
                  {t('plan.back')}
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 2, padding: 14, fontSize: 15 }}
                  onClick={goInfo}
                  disabled={!acceptTerms || !acceptFlyerStory}
                >
                  {t('plan.continue')}
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: personal info + photos ─────────────── */}
          {(step === 'info' || step === 'submitting') && (
            <>
              <div className="form-group">
                <label className="form-label">{t('publicForm.yourName')}</label>
                <input
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('publicForm.namePlaceholder')}
                  autoComplete="name"
                />
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
                  autoComplete="off"
                  autoCapitalize="off"
                />
              </div>

              {requiredPhotoCount > 0 && (
                <div className="form-group">
                  <label className="form-label">
                    {t('publicForm.photos', { count: requiredPhotoCount })}
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
                    {t('publicForm.photosHint', { count: requiredPhotoCount })}
                  </div>
                  <PhotoUploader
                    count={requiredPhotoCount}
                    value={photos}
                    onChange={setPhotos}
                  />
                </div>
              )}

              {errorMsg && (
                <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 10 }}>
                  ⚠︎ {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1, padding: 14, fontSize: 15 }}
                  onClick={() => setStep('terms')}
                  disabled={step === 'submitting'}
                >
                  {t('plan.back')}
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 2, padding: 14, fontSize: 15 }}
                  onClick={submit}
                  disabled={step === 'submitting'}
                >
                  {step === 'submitting' ? t('publicForm.submitting') : t('plan.signMeUp')}
                </button>
              </div>
            </>
          )}

          {/* ── Done: per-event outcome + flyer downloads ───── */}
          {step === 'done' && (
            <>
              <div style={{
                margin: '24px auto 16px', width: 70, height: 70,
                background: '#EAF3DE', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32,
              }}>✓</div>
              <div style={{ fontSize: 22, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>
                {t('plan.doneTitle')}
              </div>

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
                    <div style={{ fontSize: 12, color: '#8A5A00' }}>
                      {t('plan.waitlisted', { position: r.queuePosition ?? '?' })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#0F6E56' }}>
                      ✓ {t('plan.confirmed')}
                    </div>
                  )}
                  {r.flyerUrl && (
                    <div style={{ marginTop: 8 }}>
                      {isVideoUrl(r.flyerUrl) ? (
                        <video src={r.flyerUrl} controls style={{ width: '100%', borderRadius: 8 }} />
                      ) : (
                        <img src={r.flyerUrl} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                      )}
                      <button
                        className="btn-secondary"
                        style={{ width: '100%', marginTop: 8, padding: 10, fontSize: 13 }}
                        onClick={() => triggerDownload(r.flyerUrl!)}
                      >
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
        </div>
      </IonContent>
    </IonPage>
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

// Trigger a download of a remote asset by creating a hidden anchor
// and clicking it. Works on most browsers; mobile Safari sometimes
// opens the asset in a new tab instead of downloading, which is
// still a usable outcome because the guest can long-press and save.
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
