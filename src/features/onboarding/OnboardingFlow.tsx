import React, { useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { todayWeekday } from '@/core/utils/date';
import type { Timeslot, VipType, InviteType } from '@/core/types';
import { TimeslotRows, VipRows, InviteTypeRows } from '@/features/venues/VenueEditor';
import { DayChips } from '@/components/DayChips';
import { SlotChips } from '@/components/SlotChips';

type StepId = 'welcome' | 'venue' | 'event' | 'done';
const STEPS: StepId[] = ['welcome', 'venue', 'event', 'done'];

export const OnboardingFlow: React.FC<{ open: boolean; onDone: () => void }> = ({ open, onDone }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];
  const next = () => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const finish = () => onDone();

  return (
    <IonModal isOpen={open} backdropDismiss={false} canDismiss>
      <IonContent>
        <div className="onboard-progress">
          {STEPS.map((_, i) => (
            <div key={i} className={`onboard-dot ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`} />
          ))}
        </div>
        <div className="onboard-screen">
          {step === 'welcome' && <WelcomeStep onNext={next} />}
          {step === 'venue' && <VenueStep onNext={next} />}
          {step === 'event' && <EventStep onNext={next} />}
          {step === 'done' && <DoneStep onFinish={finish} />}
        </div>
      </IonContent>
    </IonModal>
  );
};

// ── Step 0: Welcome ────────────────────────────────────────
const WelcomeStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
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
    <div className="onboard-title">Welcome to PromHub</div>
    <div className="onboard-sub">All-in-one logistics for Barcelona's night promoters.</div>
    <div style={{
      background: 'var(--color-background-secondary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '4px 0',
      marginBottom: 8,
    }}>
      {[
        { icon: '♀', title: 'Guest lists', sub: 'Custom invite types, influencer tracking, club access' },
        { icon: '▤', title: 'Reservations', sub: 'VIP tables per pax range, table capacity, commissions' },
        { icon: '◈', title: 'Events', sub: 'Recurring on multiple days, custom timeslots' },
        { icon: '◉', title: 'Summary', sub: 'Daily, monthly & yearly earnings' },
      ].map((f) => (
        <div className="onboard-feature" key={f.title}>
          <div className="onboard-feature-icon">{f.icon}</div>
          <div>
            <div className="onboard-feature-title">{f.title}</div>
            <div className="onboard-feature-sub">{f.sub}</div>
          </div>
        </div>
      ))}
    </div>
    <button className="onboard-btn" onClick={onNext}>Let's get started →</button>
  </>
);

// ── Step 1: Venue ──────────────────────────────────────────
const VenueStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { upsertVenue, nextId } = useAppStore((s) => ({ upsertVenue: s.upsertVenue, nextId: s.nextId }));
  const [name, setName] = useState('');
  const [guestCap, setGuestCap] = useState<number | ''>('');
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

  const save = () => {
    if (!name.trim()) { alert('Enter a venue name.'); return; }
    const newTs = tsRows.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim() }));
    const newVip = vipRows.filter((r) => r.name.trim()).map((r) => ({
      ...r,
      name: r.name.trim(),
      minPax: r.minPax || 1,
      maxPax: r.maxPax || 10,
      tableCapacity: r.tableCapacity || 0,
    }));
    const newInv = invRows.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim() }));
    upsertVenue({
      id: nextId('venue') as number,
      name: name.trim(),
      guestCapacity: typeof guestCap === 'number' ? guestCap : (parseInt(String(guestCap)) || 0),
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
  const { venues, upsertEvent, nextId } = useAppStore((s) => ({
    venues: s.venues, upsertEvent: s.upsertEvent, nextId: s.nextId,
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

  const onVenueChange = (id: number) => {
    setVenueId(id);
    const v = venues.find((x) => x.id === id);
    setSlotIds(v?.timeslots?.length ? [v.timeslots[0].id] : []);
  };

  const toggleDay = (d: string) =>
    setDays((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]));

  const toggleSlot = (id: string) =>
    setSlotIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const save = () => {
    if (noVenues) { onNext(); return; }
    if (!name.trim()) { onNext(); return; }
    if (!slotIds.length) { alert('Select at least one timeslot.'); return; }
    if (!days.length) { alert('Select at least one day.'); return; }
    upsertEvent({
      id: nextId('event') as number,
      name: name.trim(),
      venueId: venueId!,
      weekdays: [...days],
      weekday: days[0],
      selectedSlotIds: [...slotIds],
      description: '',
      videoUrl: '',
      isPrivate: isPriv,
      isLateClub: isLate,
      invitedGuests: [],
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
            <select className="form-select" value={venueId ?? ''} onChange={(e) => onVenueChange(parseInt(e.target.value))}>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Days of week</label>
            <DayChips selected={days} onToggle={toggleDay} />
          </div>
          <div className="form-group">
            <label className="form-label">Timeslots</label>
            <SlotChips venueId={venueId} selected={slotIds} onToggle={toggleSlot} />
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

// ── Step 3: Done ──────────────────────────────────────────
const DoneStep: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const { venues, events } = useAppStore((s) => ({ venues: s.venues, events: s.events }));
  const sub = venues.length
    ? `Your venue${events.length ? ' and event are' : ' is'} ready.`
    : '';
  return (
    <>
      <div style={{
        margin: '32px auto 20px', width: 76, height: 76, background: '#EAF3DE',
        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38,
      }}>✓</div>
      <div className="onboard-title">You're all set!</div>
      <div className="onboard-sub">{sub} Start adding guests and reservations.</div>
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
      <button className="onboard-btn" onClick={onFinish}>Open PromHub →</button>
    </>
  );
};
