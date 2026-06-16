import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { IonPage, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { fetchEvent, submitRegistration, type PublicEventMeta } from '@/services/shareApi';
import { NumberField } from '@/components/NumberField';
import { PlatformPicker } from '@/components/PlatformPicker';
import type { Platform } from '@/core/types';

// ─────────────────────────────────────────────────────────────
//  Public guest-registration form.
//
//  Lives at /register/:token(?d=YYYY-MM-DD). Renders on its own
//  (no drawer, no onboarding, no app state) so anyone with the
//  link can use it even on a device that's never opened the
//  promoter app.
//
//  Flow:
//    1. Read ?d=YYYY-MM-DD (the occurrence pin) from the URL.
//    2. Fetch /api/event?token=:token&date=:d → show event header
//       with the specific date front and centre.
//    3. User fills form → POST /api/registration with that date.
//    4. Show a "thanks" screen with the option to register again.
// ─────────────────────────────────────────────────────────────

type Phase = 'loading' | 'ready' | 'submitting' | 'done' | 'not-found';

// The "Register someone else" button is intentionally gone — each
// guest gets their own confirmation moment and the promoter doesn't
// want one person flipping the form back to register a string of
// friends from the same device.

export const PublicRegistrationPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  // Pull the optional `?d=` pin out of the URL. We accept both
  // `d` (short) and `date` (verbose) since the share URL uses `d`
  // but it's harmless to support either if someone hand-edits.
  const search = new URLSearchParams(location.search);
  const dateParam = (search.get('d') ?? search.get('date') ?? '').trim();
  const occurrenceDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  const [phase, setPhase] = useState<Phase>('loading');
  const [meta, setMeta] = useState<PublicEventMeta | null>(null);
  /** Outcome of the last submit — drives the "done" screen copy.
   *  Either confirmed (waitlisted=false) or queued with a position. */
  const [outcome, setOutcome] = useState<{
    waitlisted: boolean;
    queuePosition: number | null;
  } | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [pax, setPax] = useState<number | null>(1);
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [igHandle, setIgHandle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchEvent(token, occurrenceDate)
      .then((m) => { setMeta(m); setPhase('ready'); })
      .catch(() => setPhase('not-found'));
  }, [token, occurrenceDate]);

  const submit = async () => {
    setErrorMsg(null);
    const trimmed = name.trim();
    if (!trimmed) { setErrorMsg(t('publicForm.nameRequired')); return; }
    if (!token) return;
    setPhase('submitting');
    try {
      const resp = await submitRegistration({
        token,
        // Send whatever date the server resolved (so one-time
        // events still get their own date even if the URL had no
        // pin). For recurring events this is the URL pin.
        eventDate: meta?.eventDate ?? null,
        name: trimmed,
        pax: pax ?? 1,
        igHandle: igHandle.trim().replace(/^@+/, ''),
        igPlatform: platform,
        notes: '', // notes removed from the public form
      });
      setOutcome({
        waitlisted: resp.waitlisted,
        queuePosition: resp.queuePosition,
      });
      setPhase('done');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setPhase('ready');
    }
  };

  // The date shown right under the event name — the source of truth
  // is `meta.eventDate` because the server canonicalises it (one-time
  // events ignore the URL param and use the row's date).
  const eventDateLabel = meta?.eventDate
    ? new Date(meta.eventDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  // A recurring event link without ?d= is broken — refuse to accept
  // sign-ups since we'd have no occurrence to pin them to.
  const missingDate = meta && !meta.isOneTime && !meta.eventDate;

  return (
    <IonPage>
      <IonContent>
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 18px 32px' }}>
          {/* App brand */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
          }}>
            <div style={{
              width: 32, height: 32, background: '#1a1a1a', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#F97316', fontWeight: 700, fontSize: 12 }}>P</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>PromHub</span>
          </div>

          {phase === 'loading' && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {t('publicForm.loading')}
            </div>
          )}

          {phase === 'not-found' && (
            <div className="empty-box" style={{ margin: 0 }}>
              {t('publicForm.notFound')}
            </div>
          )}

          {(phase === 'ready' || phase === 'submitting') && meta && (
            <>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                {t('publicForm.signUpFor')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>{meta.name}</div>

              {/* Prominent date card — leaves no doubt which night
                  this sign-up will be associated with. */}
              {eventDateLabel && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--color-background-secondary)',
                  border: '1px solid var(--color-primary)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px 12px',
                  marginBottom: 14,
                }}>
                  <span style={{ fontSize: 18 }}>📅</span>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {t('publicForm.date')}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {eventDateLabel}
                    </div>
                  </div>
                </div>
              )}

              {meta.venueName && (
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 18, lineHeight: 1.5 }}>
                  {t('publicForm.at')} {meta.venueName}
                </div>
              )}

              {missingDate && (
                <div style={{
                  fontSize: 12, color: '#A32D2D',
                  background: '#FDECEC', border: '0.5px solid #F3C4C4',
                  padding: '10px 12px', borderRadius: 'var(--border-radius-sm)',
                  marginBottom: 14,
                }}>
                  {t('publicForm.missingDate')}
                </div>
              )}

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
                <NumberField
                  className="form-input" min={1} max={20}
                  value={pax} onChange={setPax}
                />
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

              {errorMsg && (
                <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 10 }}>
                  ⚠︎ {errorMsg}
                </div>
              )}

              <button
                className="btn-primary"
                style={{ width: '100%', padding: 14, fontSize: 15 }}
                onClick={submit}
                disabled={phase === 'submitting' || !!missingDate}
              >
                {phase === 'submitting' ? t('publicForm.submitting') : t('publicForm.submit')}
              </button>
            </>
          )}

          {phase === 'done' && (() => {
            const isWaitlist = !!outcome?.waitlisted;
            return (
              <>
                {/* Icon: green ✓ for confirmed, amber ⏳ for waitlist */}
                <div style={{
                  margin: '32px auto 16px', width: 70, height: 70,
                  background: isWaitlist ? '#FFF4D6' : '#EAF3DE',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32,
                }}>{isWaitlist ? '⏳' : '✓'}</div>

                <div style={{ fontSize: 22, fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>
                  {isWaitlist
                    ? t('publicForm.waitlistedTitle')
                    : t('publicForm.submitted')}
                </div>

                {eventDateLabel && (
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 14 }}>
                    {t('publicForm.for')} <strong style={{ color: 'var(--color-text-primary)' }}>{eventDateLabel}</strong>
                  </div>
                )}

                {/* Waitlist-specific block: position + explanation */}
                {isWaitlist && (
                  <div style={{
                    background: '#FFF4D6',
                    border: '1px solid #E5A100',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '14px 16px',
                    marginBottom: 14,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 12, color: '#8A5A00', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                      {t('publicForm.queuePositionLabel')}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#8A5A00' }}>
                      #{outcome?.queuePosition ?? '—'}
                    </div>
                    <div style={{ fontSize: 13, color: '#8A5A00', marginTop: 8, lineHeight: 1.5 }}>
                      {t('publicForm.waitlistExplain')}
                    </div>
                  </div>
                )}

                {/* Event description always shown after both branches.
                    Falls back to a neutral note when there's no
                    description. */}
                {meta?.description?.trim() ? (
                  <div style={{
                    background: 'var(--color-background-secondary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '12px 14px',
                    fontSize: 13, lineHeight: 1.5,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    <strong style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      {t('publicForm.remember')}
                    </strong>{' '}
                    {meta.description.trim()}
                  </div>
                ) : !isWaitlist ? (
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                    {t('publicForm.seeYou')}
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>
      </IonContent>
    </IonPage>
  );
};
