import React, { useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { isoDay, todayWeekday } from '@/core/utils/date';
import { today } from '@/core/constants';
import type { Timeslot, VipType } from '@/core/types';
import { TimeslotRows, VipRows } from '@/features/venues/VenueEditor';
import { DayChips } from '@/components/DayChips';
// SlotChips dropped — events own their slots via TimeslotRows now.
import { Calendar } from '@/components/Calendar';
// NumberField dropped — event capacity is sum-of-slot-caps now.
import { SelectField } from '@/components/SelectField';
import { COUNTRY_CODES } from '@/core/constants';
import {
  formatPhone, isValidPhone, maxDigits, onlyDigits, placeholderForCode,
} from '@/core/utils/phone';

type StepId = 'welcome' | 'venue' | 'event' | 'legend' | 'done';
const STEPS: StepId[] = ['welcome', 'venue', 'event', 'legend', 'done'];

export const OnboardingFlow: React.FC<{ open: boolean; onDone: () => void }> = ({ open, onDone }) => {
  const { t } = useTranslation();
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];
  const next = () => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const back = () => setStepIdx((i) => Math.max(0, i - 1));
  const finish = () => onDone();
  const canGoBack = stepIdx > 0 && step !== 'done';

  return (
    <IonModal isOpen={open} backdropDismiss={false} canDismiss>
      <IonContent>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px 0', minHeight: 28,
        }}>
          {canGoBack && (
            <button
              type="button"
              onClick={back}
              aria-label={t('actions.back')}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 22, color: 'var(--color-text-primary)', lineHeight: 1, padding: 0,
              }}
            >‹</button>
          )}
          <div className="onboard-progress" style={{ flex: 1, padding: 0 }}>
            {STEPS.map((_, i) => (
              <div key={i} className={`onboard-dot ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`} />
            ))}
          </div>
        </div>
        <div className="onboard-screen">
          {step === 'welcome' && <WelcomeStep onNext={next} />}
          {step === 'venue' && <VenueStep onNext={next} />}
          {step === 'event' && <EventStep onNext={next} />}
          {step === 'legend' && <LegendStep onNext={next} />}
          {step === 'done' && <DoneStep onFinish={finish} />}
        </div>
      </IonContent>
    </IonModal>
  );
};

// ── Step 0: Welcome ────────────────────────────────────────
const WelcomeStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const features = [
    { icon: '♀', titleKey: 'onboarding.feature.guestsTitle',       subKey: 'onboarding.feature.guestsSub' },
    { icon: '▤', titleKey: 'onboarding.feature.reservationsTitle', subKey: 'onboarding.feature.reservationsSub' },
    { icon: '◈', titleKey: 'onboarding.feature.eventsTitle',       subKey: 'onboarding.feature.eventsSub' },
    { icon: '◉', titleKey: 'onboarding.feature.summaryTitle',      subKey: 'onboarding.feature.summarySub' },
  ];
  return (
    <>
      <div style={{
        margin: '32px auto 20px', width: 84, height: 84, background: '#1a1a1a',
        borderRadius: 20, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(249,115,22,.25)',
      }}>
        <div style={{ background: '#F97316', borderRadius: 8, padding: '4px 10px', marginBottom: 5 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#1a1a1a' }}>Prom</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 20, color: '#fff' }}>Hub</span>
      </div>
      <div className="onboard-title">{t('onboarding.welcome')}</div>
      <div className="onboard-sub">{t('onboarding.welcomeSub')}</div>
      <div style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '4px 0',
        marginBottom: 8,
      }}>
        {features.map((f) => (
          <div className="onboard-feature" key={f.titleKey}>
            <div className="onboard-feature-icon">{f.icon}</div>
            <div>
              <div className="onboard-feature-title">{t(f.titleKey)}</div>
              <div className="onboard-feature-sub">{t(f.subKey)}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="onboard-btn" onClick={onNext}>{t('onboarding.cta')}</button>
    </>
  );
};

// ── Step 1: Venue ──────────────────────────────────────────
const VenueStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const upsertVenue = useAppStore((s) => s.upsertVenue);
  const [name, setName] = useState('');
  // Phone is optional but shares the country-code + formatted-number
  // pair with the regular VenueFormModal, so a venue created at
  // onboarding looks identical to one created later.
  const [phoneCode, setPhoneCode] = useState('+34');
  const [phoneNum, setPhoneNum] = useState('');
  // Venue no longer carries capacity or timeslots after 0008 — both
  // live on the event now. VIP types stay on the venue but without
  // prices (those are per-event).
  const [vipRows, setVipRows] = useState<VipType[]>([
    { id: 'vip-seed-1', name: 'VIP', minPax: 2, maxPax: 6, tableCapacity: 5 },
    { id: 'vip-seed-2', name: 'SUPER VIP', minPax: 6, maxPax: 12, tableCapacity: 3 },
  ]);
  const phoneDigits = onlyDigits(phoneNum);
  const phoneOk = !phoneDigits || isValidPhone(phoneCode, phoneDigits);

  const save = async () => {
    if (!name.trim()) { alert(t('venueForm.errNameRequired')); return; }
    if (phoneDigits && !phoneOk) {
      alert(t('venueForm.errPhoneFmt', { code: phoneCode }));
      return;
    }
    const newVip = vipRows.filter((r) => r.name.trim()).map((r) => ({
      id: r.id,
      name: r.name.trim(),
      minPax: r.minPax || 1,
      maxPax: r.maxPax || 10,
      tableCapacity: r.tableCapacity || 0,
    }));
    await upsertVenue({
      name: name.trim(),
      phoneCode: phoneDigits ? phoneCode : '',
      phoneNum: phoneDigits ? phoneNum.trim() : '',
      vipTypes: newVip,
    });
    onNext();
  };

  return (
    <>
      <div style={{ marginTop: 24 }} />
      <div className="onboard-step-label">{t('onboarding.step1of2')}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
        {t('onboarding.addFirstVenue')}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
        {t('onboarding.addFirstVenueSub')}
      </div>
      <div className="form-group">
        <label className="form-label">{t('venueForm.name')} *</label>
        <input className="form-input" placeholder={t('venueForm.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">{t('venueForm.phone')}</label>
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
            options={COUNTRY_CODES.map((c) => ({
              value: c.code,
              label: `${c.flag} ${c.code}`,
            }))}
          />
          <input
            className="form-input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={placeholderForCode(phoneCode)}
            value={phoneNum}
            onChange={(e) => {
              const limited = onlyDigits(e.target.value).slice(0, maxDigits(phoneCode));
              setPhoneNum(formatPhone(phoneCode, limited));
            }}
          />
        </div>
        {phoneDigits.length > 0 && !phoneOk && (
          <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>
            {t('venueForm.phoneFmtError', { code: phoneCode, example: placeholderForCode(phoneCode) })}
          </div>
        )}
      </div>

      <VipRows rows={vipRows} setRows={setVipRows} />
      <button className="onboard-btn" onClick={save}>{t('onboarding.saveVenueContinue')}</button>
      <button className="onboard-btn-secondary" onClick={onNext}>{t('actions.skip')}</button>
    </>
  );
};

// ── Step 2: Event ─────────────────────────────────────────
const EventStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const { venues, upsertEvent } = useAppStore((s) => ({
    venues: s.venues, upsertEvent: s.upsertEvent,
  }));
  const noVenues = venues.length === 0;
  const [name, setName] = useState('');
  const [venueId, setVenueId] = useState<number | null>(venues[0]?.id ?? null);
  const [days, setDays] = useState<string[]>([todayWeekday()]);
  // Events own their slots after 0008 — seeded with one default
  // slot so the onboarding doesn't dead-end on capacity validation.
  const [tsRows, setTsRows] = useState<Timeslot[]>([
    { id: 'ts-seed-1', name: 'Tardeo', startTime: '16:00', endTime: '23:00', guestCapacity: 0 },
  ]);
  const [isPriv, setPriv] = useState(false);
  const [isLate, setLate] = useState(false);
  const [isOneTime, setIsOneTime] = useState(false);
  const [eventDate, setEventDate] = useState<string>(isoDay(today()));
  const [seasonStart, setSeasonStart] = useState<string>('');
  const [seasonEnd, setSeasonEnd] = useState<string>('');
  const [desc, setDesc] = useState('');

  const onVenueChange = (id: number) => {
    setVenueId(id);
  };

  const toggleDay = (d: string) =>
    setDays((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]));

  const save = async () => {
    if (noVenues) { onNext(); return; }
    if (!name.trim()) { onNext(); return; }
    const cleanSlots = tsRows
      .filter((r) => r.name.trim())
      .map((r) => ({ ...r, name: r.name.trim() }));
    if (!cleanSlots.length) { alert(t('eventForm.errSelectSlot')); return; }
    if (isOneTime) {
      if (!eventDate) { alert(t('eventForm.errPickDate')); return; }
    } else {
      if (!days.length) { alert(t('eventForm.errSelectDay')); return; }
      if (seasonStart && seasonEnd && seasonEnd < seasonStart) {
        alert(t('eventForm.errSeasonOrder'));
        return;
      }
    }
    await upsertEvent({
      name: name.trim(),
      venueId: venueId!,
      weekdays: isOneTime ? [] : [...days],
      weekday: isOneTime ? '' : days[0],
      description: desc.trim(),
      videoUrl: '',
      isPrivate: isPriv,
      isLateClub: isLate,
      invitedGuests: [],
      isOneTime,
      eventDate: isOneTime ? eventDate : null,
      timeslots: cleanSlots,
      vipPrices: {},
      // Fixed-fee config isn't part of the onboarding form — leave
      // it null and the promoter can edit the event later to set it.
      minGuestsThreshold: null,
      fixedFee: null,
      perExtraGuestFee: null,
      photoCount: null,
      seasonStart: !isOneTime && seasonStart ? seasonStart : null,
      seasonEnd: !isOneTime && seasonEnd ? seasonEnd : null,
      shareToken: null,
    });
    onNext();
  };

  return (
    <>
      <div style={{ marginTop: 24 }} />
      <div className="onboard-step-label">{t('onboarding.step2of2')}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
        {t('onboarding.createFirstEvent')}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
        {t('onboarding.createFirstEventSub')}
      </div>
      {noVenues ? (
        <div className="empty-box" style={{ margin: '0 0 16px' }}>{t('onboarding.noVenuesYet')}</div>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">{t('eventForm.name')} *</label>
            <input className="form-input" placeholder={t('eventForm.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('eventForm.venue')}</label>
            <SelectField
              value={venueId}
              onChange={(v) => onVenueChange(Number(v))}
              title={t('common.pickAVenue')}
              options={venues.map((v) => ({ value: v.id, label: v.name }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('eventForm.schedule')}</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button type="button" className={`tog-btn ${!isOneTime ? 'on' : ''}`} onClick={() => setIsOneTime(false)}>
                {t('eventForm.recurring')}
              </button>
              <button type="button" className={`tog-btn ${isOneTime ? 'on' : ''}`} onClick={() => setIsOneTime(true)}>
                {t('eventForm.oneTime')}
              </button>
            </div>

            {isOneTime ? (
              <Calendar
                mode="single"
                value={eventDate || null}
                onChange={(iso) => setEventDate(iso ?? '')}
                initialMonth={eventDate ? new Date(eventDate + 'T00:00:00') : undefined}
              />
            ) : (
              <>
                <DayChips selected={days} onToggle={toggleDay} />
                <div style={{ marginTop: 12 }}>
                  <div className="form-label" style={{ marginBottom: 6 }}>{t('eventForm.season')}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    {t('eventForm.seasonHint')}
                  </div>
                  <Calendar
                    mode="range"
                    start={seasonStart || null}
                    end={seasonEnd || null}
                    onChange={(s, e) => { setSeasonStart(s ?? ''); setSeasonEnd(e ?? ''); }}
                    initialMonth={seasonStart ? new Date(seasonStart + 'T00:00:00') : undefined}
                  />
                  {(seasonStart || seasonEnd) && (
                    <button
                      type="button"
                      className="btn-sm"
                      style={{ marginTop: 8, width: '100%' }}
                      onClick={() => { setSeasonStart(''); setSeasonEnd(''); }}
                    >{t('eventForm.clearRange')}</button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Timeslots editor — event-owned post-0008. Each slot
              carries its own per-night capacity; sum = night cap. */}
          <TimeslotRows rows={tsRows} setRows={setTsRows} />
          <div className="form-group">
            <label className="form-label">{t('eventForm.description')}</label>
            <textarea
              className="form-textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t('eventForm.descPlaceholder')}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('eventForm.eventType')}</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#F97316', width: 18, height: 18 }} checked={isPriv} onChange={(e) => setPriv(e.target.checked)} /> {t('eventForm.eventTypePrivate')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#F97316', width: 18, height: 18 }} checked={isLate} onChange={(e) => setLate(e.target.checked)} /> {t('eventForm.eventTypeLateClub')}
              </label>
            </div>
          </div>
        </>
      )}
      <button className="onboard-btn" onClick={save}>{noVenues ? t('actions.skipArrow') : t('onboarding.saveEventFinish')}</button>
      <button className="onboard-btn-secondary" onClick={onNext}>{t('actions.skip')}</button>
    </>
  );
};

// ── Step 3: Legend ─────────────────────────────────────────
//  Visual key for every color/dot/border the app uses. Promoters
//  who skim the UI fast will benefit from seeing these once up
//  front so they don't wonder what each marker means.
const LegendStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  return (
  <>
    <div style={{ marginTop: 24 }} />
    <div className="onboard-step-label">{t('onboarding.legendTitle')}</div>
    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
      {t('onboarding.legendTitle')}
    </div>
    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
      {t('onboarding.legendSub')}
    </div>

    <LegendSection title={t('onboarding.legend.eventCards')}>
      <LegendRow
        sample={<div style={{
          width: 26, height: 26, background: 'var(--color-background-primary)',
          borderRadius: 6, borderLeft: '3px solid #D4537E',
        }} />}
        label={t('onboarding.legend.pinkBorder')}
        sub={t('onboarding.legend.pinkBorderSub')}
      />
      <LegendRow
        sample={<div style={{
          width: 26, height: 26, background: 'var(--color-background-primary)',
          borderRadius: 6, borderLeft: '3px solid #7C3AED',
        }} />}
        label={t('onboarding.legend.purpleBorder')}
        sub={t('onboarding.legend.purpleBorderSub')}
      />
    </LegendSection>

    <LegendSection title={t('onboarding.legend.guestList')}>
      <LegendRow
        sample={<span style={{ color: '#F97316', fontSize: 18 }}>★</span>}
        label={t('onboarding.legend.orangeStar')}
        sub={t('onboarding.legend.orangeStarSub')}
      />
      <LegendRow
        sample={<div className="arrived-dot" style={{ width: 9, height: 9 }} />}
        label={t('onboarding.legend.greenDot')}
        sub={t('onboarding.legend.greenDotSub')}
      />
      <LegendRow
        sample={<div className="pending-dot" style={{ width: 9, height: 9 }} />}
        label={t('onboarding.legend.grayDot')}
        sub={t('onboarding.legend.grayDotSub')}
      />
      <LegendRow
        sample={<span className="ig-badge">IG</span>}
        label={t('onboarding.legend.socialBadge')}
        sub={t('onboarding.legend.socialBadgeSub')}
      />
    </LegendSection>

    <LegendSection title={t('onboarding.legend.pillsStatus')}>
      <LegendRow sample={<span className="pill pill-blue">{t('onboarding.legend.sampleGuests', { used: 3, capacity: 20 })}</span>} label={t('onboarding.legend.bluePill')} sub={t('onboarding.legend.bluePillSub')} />
      <LegendRow sample={<span className="pill pill-green">{t('onboarding.legend.sampleReservations', { count: 2 })}</span>} label={t('onboarding.legend.greenPill')} sub={t('onboarding.legend.greenPillSub')} />
      <LegendRow sample={<span className="pill pill-teal">{t('onboarding.legend.sampleInvited', { count: 5 })}</span>} label={t('onboarding.legend.tealPill')} sub={t('onboarding.legend.tealPillSub')} />
      <LegendRow sample={<span className="pill pill-purple">{t('onboarding.legend.sampleClub')}</span>} label={t('onboarding.legend.purplePill')} sub={t('onboarding.legend.purplePillSub')} />
      <LegendRow sample={<span className="pill pill-pink">{t('onboarding.legend.samplePrivate')}</span>} label={t('onboarding.legend.pinkPill')} sub={t('onboarding.legend.pinkPillSub')} />
    </LegendSection>

    <LegendSection title={t('onboarding.legend.capacityBar')}>
      <div style={{ padding: '4px 0' }}>
        <div className="capacity-bar"><div className="capacity-fill" style={{ width: '40%' }} /></div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{t('onboarding.legend.capacityLow')}</div>
      </div>
      <div style={{ padding: '4px 0' }}>
        <div className="capacity-bar"><div className="capacity-fill warn" style={{ width: '85%' }} /></div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{t('onboarding.legend.capacityWarn')}</div>
      </div>
      <div style={{ padding: '4px 0' }}>
        <div className="capacity-bar"><div className="capacity-fill full" style={{ width: '100%' }} /></div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{t('onboarding.legend.capacityFull')}</div>
      </div>
    </LegendSection>

    <button className="onboard-btn" onClick={onNext}>{t('onboarding.legendGot')}</button>
  </>
  );
};

const LegendSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{
    background: 'var(--color-background-secondary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '4px 14px', marginBottom: 14,
  }}>
    <div style={{
      fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)',
      textTransform: 'uppercase', letterSpacing: '.04em',
      padding: '10px 0 4px',
    }}>{title}</div>
    {children}
  </div>
);

const LegendRow: React.FC<{ sample: React.ReactNode; label: string; sub: string }> = ({ sample, label, sub }) => (
  <div className="legend-row">
    <div className="legend-row-sample">{sample}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{sub}</div>
    </div>
  </div>
);

// ── Step 4: Done ──────────────────────────────────────────
const DoneStep: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const { t } = useTranslation();
  return (
    <>
      <div style={{
        margin: '32px auto 20px', width: 76, height: 76, background: '#EAF3DE',
        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38,
      }}>✓</div>
      <div className="onboard-title">{t('onboarding.doneTitle')}</div>
      <div style={{
        background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)',
        padding: '12px 14px', marginTop: 16,
      }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {t('onboarding.doneWhatsNext')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 2.1 }}>
          ♀ &nbsp;{t('onboarding.doneTip1')}<b>{t('onboarding.doneTip1Bold')}</b><br />
          ▤ &nbsp;{t('onboarding.doneTip2')}<b>{t('onboarding.doneTip2Bold')}</b><br />
          ⊞ &nbsp;{t('onboarding.doneTip3')}<b>{t('onboarding.doneTip3Bold')}</b><br />
          ◉ &nbsp;{t('onboarding.doneTip4')}<b>{t('onboarding.doneTip4Bold')}</b>
        </div>
      </div>
      <button className="onboard-btn" onClick={onFinish}>{t('onboarding.doneCta')}</button>
    </>
  );
};
