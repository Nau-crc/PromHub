import React, { useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { isoDay, todayWeekday } from '@/core/utils/date';
import { today } from '@/core/constants';
import type { Timeslot, VipType, InviteType } from '@/core/types';
import { TimeslotRows, VipRows, InviteTypeRows } from '@/features/venues/VenueEditor';
import { DayChips } from '@/components/DayChips';
import { SlotChips } from '@/components/SlotChips';
import { Calendar } from '@/components/Calendar';
import { NumberField } from '@/components/NumberField';
import { SelectField } from '@/components/SelectField';
import { COUNTRY_CODES } from '@/core/constants';
import {
  formatPhone, isValidPhone, maxDigits, onlyDigits, placeholderForCode,
} from '@/core/utils/phone';

type StepId = 'welcome' | 'venue' | 'event' | 'legend' | 'done';
const STEPS: StepId[] = ['welcome', 'venue', 'event', 'legend', 'done'];

export const OnboardingFlow: React.FC<{ open: boolean; onDone: () => void }> = ({ open, onDone }) => {
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
              aria-label="Back"
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
  const upsertVenue = useAppStore((s) => s.upsertVenue);
  const [name, setName] = useState('');
  const [guestCap, setGuestCap] = useState<number | ''>('');
  // Phone is optional but shares the country-code + formatted-number
  // pair with the regular VenueFormModal, so a venue created at
  // onboarding looks identical to one created later.
  const [phoneCode, setPhoneCode] = useState('+34');
  const [phoneNum, setPhoneNum] = useState('');
  const [tsRows, setTsRows] = useState<Timeslot[]>([
    { id: 'ts-seed-1', name: 'Tardeo', startTime: '16:00', endTime: '23:00', guestCapacity: 0 },
  ]);
  const [vipRows, setVipRows] = useState<VipType[]>([
    { id: 'vip-seed-1', name: 'VIP', price: 500, minPax: 2, maxPax: 6, tableCapacity: 5 },
    { id: 'vip-seed-2', name: 'SUPER VIP', price: 1000, minPax: 6, maxPax: 12, tableCapacity: 3 },
  ]);
  const [invRows, setInvRows] = useState<InviteType[]>([
    { id: 'inv-seed-1', name: 'Dinner + Cocktails' },
    { id: 'inv-seed-2', name: 'Cocktails only' },
  ]);

  const phoneDigits = onlyDigits(phoneNum);
  const phoneOk = !phoneDigits || isValidPhone(phoneCode, phoneDigits);

  const save = async () => {
    if (!name.trim()) { alert('Enter a venue name.'); return; }
    if (phoneDigits && !phoneOk) {
      alert(`Phone number doesn't match the format for ${phoneCode}.`);
      return;
    }
    const newTs = tsRows.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim() }));
    const newVip = vipRows.filter((r) => r.name.trim()).map((r) => ({
      ...r,
      name: r.name.trim(),
      minPax: r.minPax || 1,
      maxPax: r.maxPax || 10,
      tableCapacity: r.tableCapacity || 0,
    }));
    const newInv = invRows.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim() }));
    await upsertVenue({
      name: name.trim(),
      guestCapacity: typeof guestCap === 'number' ? guestCap : (parseInt(String(guestCap)) || 0),
      phoneCode: phoneDigits ? phoneCode : '',
      phoneNum: phoneDigits ? phoneNum.trim() : '',
      timeslots: newTs,
      vipTypes: newVip,
      inviteTypes: newInv,
    });
    onNext();
  };

  return (
    <>
      <div style={{ marginTop: 24 }} />
      <div className="onboard-step-label">Step 1 of 2</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
        Add your first venue
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
        Set timeslots, VIP table types with pax ranges & table capacity, and invitation types. VIP prices are per table.
      </div>
      <div className="form-group">
        <label className="form-label">Venue name *</label>
        <input className="form-input" placeholder="e.g. Carpe Diem" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Guest capacity</label>
        <input
          className="form-input"
          type="number"
          placeholder="e.g. 200"
          min={0}
          value={guestCap}
          onChange={(e) => setGuestCap(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Phone (optional)</label>
        <div className="phone-row">
          <SelectField
            value={phoneCode}
            onChange={(code) => {
              setPhoneCode(code);
              const limited = onlyDigits(phoneNum).slice(0, maxDigits(code));
              setPhoneNum(formatPhone(code, limited));
            }}
            title="Country code"
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
            ⚠︎ Format for {phoneCode} doesn't match. Expected like: {placeholderForCode(phoneCode)}
          </div>
        )}
      </div>

      <TimeslotRows rows={tsRows} setRows={setTsRows} />
      <VipRows rows={vipRows} setRows={setVipRows} />
      <InviteTypeRows rows={invRows} setRows={setInvRows} />
      <button className="onboard-btn" onClick={save}>Save venue & continue →</button>
      <button className="onboard-btn-secondary" onClick={onNext}>Skip for now</button>
    </>
  );
};

// ── Step 2: Event ─────────────────────────────────────────
const EventStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { venues, upsertEvent } = useAppStore((s) => ({
    venues: s.venues, upsertEvent: s.upsertEvent,
  }));
  const noVenues = venues.length === 0;
  const [name, setName] = useState('');
  const [venueId, setVenueId] = useState<number | null>(venues[0]?.id ?? null);
  const [days, setDays] = useState<string[]>([todayWeekday()]);
  const [slotIds, setSlotIds] = useState<string[]>(() => {
    const v = venues[0];
    return v?.timeslots?.length ? [v.timeslots[0].id] : [];
  });
  const [isPriv, setPriv] = useState(false);
  const [isLate, setLate] = useState(false);
  const [isOneTime, setIsOneTime] = useState(false);
  const [eventDate, setEventDate] = useState<string>(isoDay(today()));
  const [seasonStart, setSeasonStart] = useState<string>('');
  const [seasonEnd, setSeasonEnd] = useState<string>('');
  const [capacity, setCapacity] = useState<number | null>(null);
  const [desc, setDesc] = useState('');

  const onVenueChange = (id: number) => {
    setVenueId(id);
    const v = venues.find((x) => x.id === id);
    setSlotIds(v?.timeslots?.length ? [v.timeslots[0].id] : []);
  };

  const toggleDay = (d: string) =>
    setDays((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]));

  const toggleSlot = (id: string) =>
    setSlotIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const save = async () => {
    if (noVenues) { onNext(); return; }
    if (!name.trim()) { onNext(); return; }
    if (!slotIds.length) { alert('Select at least one timeslot.'); return; }
    if (isOneTime) {
      if (!eventDate) { alert('Pick a date.'); return; }
    } else {
      if (!days.length) { alert('Select at least one day.'); return; }
      if (seasonStart && seasonEnd && seasonEnd < seasonStart) {
        alert('Season end must be on or after season start.');
        return;
      }
    }
    await upsertEvent({
      name: name.trim(),
      venueId: venueId!,
      weekdays: isOneTime ? [] : [...days],
      weekday: isOneTime ? '' : days[0],
      selectedSlotIds: [...slotIds],
      description: desc.trim(),
      videoUrl: '',
      isPrivate: isPriv,
      isLateClub: isLate,
      invitedGuests: [],
      isOneTime,
      eventDate: isOneTime ? eventDate : null,
      capacity: capacity && capacity > 0 ? capacity : null,
      seasonStart: !isOneTime && seasonStart ? seasonStart : null,
      seasonEnd: !isOneTime && seasonEnd ? seasonEnd : null,
      shareToken: null,
    });
    onNext();
  };

  return (
    <>
      <div style={{ marginTop: 24 }} />
      <div className="onboard-step-label">Step 2 of 2</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
        Create your first event
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
        Events are recurring nights. They can run on multiple days of the week.
      </div>
      {noVenues ? (
        <div className="empty-box" style={{ margin: '0 0 16px' }}>No venues added yet.</div>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">Event name *</label>
            <input className="form-input" placeholder="e.g. The Sailor" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Venue</label>
            <SelectField
              value={venueId}
              onChange={(v) => onVenueChange(Number(v))}
              title="Pick a venue"
              options={venues.map((v) => ({ value: v.id, label: v.name }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Schedule</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button type="button" className={`tog-btn ${!isOneTime ? 'on' : ''}`} onClick={() => setIsOneTime(false)}>
                Recurring
              </button>
              <button type="button" className={`tog-btn ${isOneTime ? 'on' : ''}`} onClick={() => setIsOneTime(true)}>
                One-time
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
                  <div className="form-label" style={{ marginBottom: 6 }}>Season (optional)</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    Tap the start date, then the end date.
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
                    >Clear range (open-ended)</button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Timeslots</label>
            <SlotChips venueId={venueId} selected={slotIds} onToggle={toggleSlot} />
          </div>

          <div className="form-group">
            <label className="form-label">Capacity (max guests, optional)</label>
            <NumberField
              className="form-input" placeholder="e.g. 20" min={0}
              value={capacity} onChange={setCapacity}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What's special about this night?"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Event type</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#F97316', width: 18, height: 18 }} checked={isPriv} onChange={(e) => setPriv(e.target.checked)} /> Private
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#F97316', width: 18, height: 18 }} checked={isLate} onChange={(e) => setLate(e.target.checked)} /> 🌙 Late-night club
              </label>
            </div>
          </div>
        </>
      )}
      <button className="onboard-btn" onClick={save}>{noVenues ? 'Skip →' : 'Save event & finish →'}</button>
      <button className="onboard-btn-secondary" onClick={onNext}>Skip for now</button>
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

    <LegendSection title="Event cards">
      <LegendRow
        sample={<div style={{
          width: 26, height: 26, background: 'var(--color-background-primary)',
          borderRadius: 6, borderLeft: '3px solid #D4537E',
        }} />}
        label="Pink left border"
        sub="Private event — invite-only guest list."
      />
      <LegendRow
        sample={<div style={{
          width: 26, height: 26, background: 'var(--color-background-primary)',
          borderRadius: 6, borderLeft: '3px solid #7C3AED',
        }} />}
        label="Purple left border"
        sub="Late-night club — runs after midnight."
      />
    </LegendSection>

    <LegendSection title="Guest list">
      <LegendRow
        sample={<span style={{ color: '#F97316', fontSize: 18 }}>★</span>}
        label="Orange star"
        sub="Influencer (10k+ followers). Counts in the influencer summary."
      />
      <LegendRow
        sample={<div className="arrived-dot" style={{ width: 9, height: 9 }} />}
        label="Green dot"
        sub="Arrived (checked in tonight)."
      />
      <LegendRow
        sample={<div className="pending-dot" style={{ width: 9, height: 9 }} />}
        label="Gray dot"
        sub="Pending (still expected). Swipe right on a guest to toggle."
      />
      <LegendRow
        sample={<span className="ig-badge">IG</span>}
        label="IG / TT badge"
        sub="Instagram or TikTok handle. Tap to open the profile."
      />
    </LegendSection>

    <LegendSection title="Pills & status">
      <LegendRow sample={<span className="pill pill-blue">3/20 guests</span>} label="Blue pill" sub="Guests on this date / capacity." />
      <LegendRow sample={<span className="pill pill-green">2 res.</span>} label="Green pill" sub="Reservations on this date." />
      <LegendRow sample={<span className="pill pill-teal">5 invited</span>} label="Teal pill" sub="Invitations sent for a private event." />
      <LegendRow sample={<span className="pill pill-purple">🌙 Club</span>} label="Purple pill" sub="Linked late-night club event." />
      <LegendRow sample={<span className="pill pill-pink">Private</span>} label="Pink pill" sub="Private event marker." />
    </LegendSection>

    <LegendSection title="Capacity bar">
      <div style={{ padding: '4px 0' }}>
        <div className="capacity-bar"><div className="capacity-fill" style={{ width: '40%' }} /></div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>Orange — comfortably under capacity.</div>
      </div>
      <div style={{ padding: '4px 0' }}>
        <div className="capacity-bar"><div className="capacity-fill warn" style={{ width: '85%' }} /></div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>Amber — close to full (75%+).</div>
      </div>
      <div style={{ padding: '4px 0' }}>
        <div className="capacity-bar"><div className="capacity-fill full" style={{ width: '100%' }} /></div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>Red — full or over capacity.</div>
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
          What's next
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 2.1 }}>
          ♀ &nbsp;Add guests → <b>Guest list</b><br />
          ▤ &nbsp;Log VIP tables → <b>Reservations</b><br />
          ⊞ &nbsp;Add venues → <b>More → Venues</b><br />
          ◉ &nbsp;See earnings → <b>More → Summary</b>
        </div>
      </div>
      <button className="onboard-btn" onClick={onFinish}>{t('onboarding.doneCta')}</button>
    </>
  );
};
