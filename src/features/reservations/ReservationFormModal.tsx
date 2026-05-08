import React, { useEffect, useMemo, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import type { Platform, Reservation } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { COUNTRY_CODES } from '@/core/constants';
import {
  getVipOptionsForPax, getVipPrice, nextOccurrence, occurs,
  venueById, venueVipSlotsLeft,
} from '@/features/summary/calculations';
import { round2 } from '@/core/utils/format';
import { isoDay } from '@/core/utils/date';
import { today } from '@/core/constants';
import { SheetHeader } from '@/components/SheetHeader';
import { PlatformPicker } from '@/components/PlatformPicker';
import { NumberField } from '@/components/NumberField';
import { OccurrencePicker } from '@/components/OccurrencePicker';
import { formatPhone, isValidPhone, maxDigits, onlyDigits, placeholderForCode } from '@/core/utils/phone';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Reservation | null;
  seedEventId?: number;
}

export const ReservationFormModal: React.FC<Props> = ({ open, onClose, editing, seedEventId }) => {
  const { venues, events, reservations, upsertReservation, removeReservation, nextId } = useAppStore((s) => ({
    venues: s.venues, events: s.events, reservations: s.reservations,
    upsertReservation: s.upsertReservation, removeReservation: s.removeReservation, nextId: s.nextId,
  }));

  const [name, setName] = useState('');
  const [phoneCode, setPhoneCode] = useState('+34');
  const [phoneNum, setPhoneNum] = useState('');
  const [venueId, setVenueId] = useState<number | null>(null);
  const [pax, setPax] = useState<number | null>(null);
  const [vipType, setVipType] = useState<string>('');
  const [slotId, setSlotId] = useState<string>('');
  const [eventId, setEventId] = useState<number | null>(null);
  const [eventDate, setEventDate] = useState<string>('');
  const [commissionPct, setCommissionPct] = useState<number | null>(10);
  const [fromInvite, setFromInvite] = useState(false);
  const [inviterPlatform, setInviterPlatform] = useState<Platform>('instagram');
  const [inviterHandle, setInviterHandle] = useState('');
  const [commissionEarner, setCommissionEarner] = useState('');
  const [womanPct, setWomanPct] = useState<number | null>(50);

  // Hydrate when (re)opening
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setPhoneCode(editing?.phoneCode ?? '+34');
    setPhoneNum(editing?.phoneNum ?? '');
    setVenueId(editing?.venueId ?? venues[0]?.id ?? null);
    setPax(editing?.pax ?? null);
    setVipType(editing?.vipType ?? '');
    setSlotId(editing?.slotId ?? '');
    const startEv = editing ? editing.eventId : (seedEventId ?? null);
    setEventId(startEv);
    setEventDate(initialEventDate(startEv, editing?.eventDate ?? null));
    setCommissionPct(editing?.commissionPct ?? 10);
    setFromInvite(!!editing?.fromInvite);
    setInviterPlatform(editing?.inviterPlatform ?? 'instagram');
    setInviterHandle(editing?.inviterHandle ?? '');
    setCommissionEarner(editing?.commissionEarner ?? '');
    setWomanPct(editing?.womanPct ?? 50);
  }, [open, editing, seedEventId, venues]);

  // Defaults eventDate when an event is (re)picked
  function initialEventDate(evId: number | null, prevDate: string | null): string {
    if (evId == null) return '';
    const ev = events.find((e) => e.id === evId);
    if (!ev) return '';
    if (ev.isOneTime) return ev.eventDate ?? '';
    if (prevDate) return prevDate;
    return nextOccurrence(ev, isoDay(today())) ?? '';
  }

  const selectedEvent = eventId != null ? events.find((e) => e.id === eventId) : null;
  const eventDateValid = !selectedEvent
    || (selectedEvent.isOneTime
        ? selectedEvent.eventDate === eventDate
        : !!eventDate && occurs(selectedEvent, eventDate));

  // Re-default eventDate when the linked event changes
  useEffect(() => {
    setEventDate((prev) => initialEventDate(eventId, prev || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const v = venueId != null ? venueById(venueId, venues) : undefined;
  const paxN = pax ?? 0;
  const vipOpts = useMemo(
    () => (venueId != null ? getVipOptionsForPax(venueId, paxN, venues) : []),
    [venueId, paxN, venues],
  );
  const slots = v?.timeslots || [];

  // Auto-correct VIP type when options change (matches MVP `updateResVipForPax`)
  useEffect(() => {
    if (!vipOpts.length) {
      if (vipType !== '') setVipType('');
      return;
    }
    if (!vipOpts.find((t) => t.name === vipType)) {
      setVipType(vipOpts[0].name);
    }
  }, [vipOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-default slot when venue changes
  useEffect(() => {
    if (!slots.length) { if (slotId) setSlotId(''); return; }
    if (!slots.find((s) => s.id === slotId)) {
      setSlotId(slots[0].id);
    }
  }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live commission preview (mirrors `previewComm` byte-for-byte) ──
  const price = venueId != null ? getVipPrice(venueId, vipType, venues) : 0;
  const commissionPctN = commissionPct ?? 0;
  const womanPctN = womanPct ?? 0;
  const promoter = round2(price * commissionPctN / 100);
  const woman = fromInvite ? round2(promoter * womanPctN / 100) : 0;
  const net = round2(promoter - woman);

  const phoneDigits = onlyDigits(phoneNum);
  const phoneOk = !phoneDigits || isValidPhone(phoneCode, phoneDigits);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (venueId == null) return;
    if (selectedEvent && !eventDateValid) {
      alert('The event date you picked is not a valid occurrence of this event.');
      return;
    }
    if (phoneDigits && !phoneOk) {
      alert(`Phone number doesn't match the format for ${phoneCode}.`);
      return;
    }
    const entry: Reservation = {
      id: editing?.id ?? (nextId('res') as number),
      name: trimmed,
      phoneCode,
      phoneNum: phoneNum.trim(),
      venueId,
      eventId: eventId ?? null,
      vipType,
      slotId,
      pax: pax ?? 2,
      fromInvite,
      inviterHandle: fromInvite ? inviterHandle.trim() : '',
      inviterPlatform,
      commissionPct: commissionPctN,
      womanPct: fromInvite ? womanPctN : 0,
      commissionEarner: fromInvite ? commissionEarner.trim() : '',
      createdAt: editing?.createdAt ?? isoDay(today()),
      eventDate: selectedEvent ? (eventDate || null) : null,
    };
    upsertReservation(entry);
    onClose();
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]}>
      <IonContent>
        <SheetHeader title={editing ? 'Edit reservation' : 'Add reservation'} onClose={onClose} />
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="form-group">
            <label className="form-label">Contact name</label>
            <input className="form-input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Phone</label>
            <div className="phone-row">
              <select
                className="form-select"
                value={phoneCode}
                onChange={(e) => {
                  setPhoneCode(e.target.value);
                  // Re-format / truncate the existing number for the new country
                  const limited = onlyDigits(phoneNum).slice(0, maxDigits(e.target.value));
                  setPhoneNum(formatPhone(e.target.value, limited));
                }}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
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

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Venue</label>
              <select className="form-select" value={venueId ?? ''} onChange={(e) => setVenueId(parseInt(e.target.value))}>
                {venues.map((vv) => <option key={vv.id} value={vv.id}>{vv.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Pax</label>
              <NumberField
                className="form-input" min={1} placeholder="# people"
                value={pax} onChange={setPax}
              />
            </div>
          </div>

          <div className="info-box">
            VIP options filter by pax. Price is per table. Available tables shown.
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">VIP type</label>
              <select className="form-select" value={vipType} onChange={(e) => setVipType(e.target.value)}>
                {vipOpts.length ? vipOpts.map((t) => {
                  const left = venueVipSlotsLeft(venueId!, t.name, venues, reservations);
                  const cap = t.tableCapacity || 0;
                  return (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.minPax}–{t.maxPax} pax) €{t.price}{cap ? ` · ${left}/${cap} tbls left` : ''}
                    </option>
                  );
                }) : <option value="">— Enter pax above —</option>}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Timeslot</label>
              <select className="form-select" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                {slots.length ? slots.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                )) : <option value="">No timeslots</option>}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Linked event</label>
            <select className="form-select" value={eventId ?? ''} onChange={(e) => setEventId(e.target.value ? parseInt(e.target.value) : null)}>
              <option value="">— None —</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {selectedEvent && !selectedEvent.isOneTime && (
            <div className="form-group">
              <label className="form-label">Event date</label>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Use the arrows to step through this event's occurrences.
              </div>
              <OccurrencePicker
                event={selectedEvent}
                value={eventDate}
                onChange={setEventDate}
              />
            </div>
          )}
          {selectedEvent?.isOneTime && selectedEvent.eventDate && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '-6px 0 12px' }}>
              Event date: <b>{selectedEvent.eventDate}</b>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Your commission %</label>
            <NumberField
              className="form-input" min={0} max={100} decimal
              value={commissionPct} onChange={setCommissionPct}
            />
          </div>

          <div className="check-row">
            <input id="rFromInv" type="checkbox" checked={fromInvite} onChange={(e) => setFromInvite(e.target.checked)} />
            <label htmlFor="rFromInv">Via invitation — split commission</label>
          </div>

          {fromInvite && (
            <>
              <div className="info-box">Someone invited this contact. They earn a % of your commission.</div>
              <div className="form-group">
                <label className="form-label">Inviter's platform</label>
                <PlatformPicker value={inviterPlatform} onChange={setInviterPlatform} />
                <input
                  className="form-input" placeholder="Inviter's handle (no @)"
                  value={inviterHandle} onChange={(e) => setInviterHandle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Inviter's name</label>
                <input className="form-input" placeholder="Full name"
                  value={commissionEarner} onChange={(e) => setCommissionEarner(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Their % of your commission</label>
                <NumberField
                  className="form-input" min={0} max={100} decimal
                  value={womanPct} onChange={setWomanPct}
                />
              </div>
            </>
          )}

          <div className="comm-breakdown">
            {!price ? (
              <span style={{ fontSize: 12 }}>
                Set a price for this VIP type in Venues to see breakdown.
              </span>
            ) : (
              <>
                Table price: <b>€{price}</b> · {paxN || 1} pax<br />
                Your commission ({commissionPctN}%): <b style={{ color: '#3B6D11' }}>€{promoter}</b>
                {fromInvite && womanPctN > 0 && (
                  <>
                    <br />{(commissionEarner || 'Inviter')}'s cut ({womanPctN}%): <b style={{ color: '#F97316' }}>€{woman}</b>
                    <br />Net to you: <b style={{ color: '#3B6D11' }}>€{net}</b>
                  </>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {editing && (
              <button className="btn-danger" onClick={() => { removeReservation(editing.id); onClose(); }}>
                Delete
              </button>
            )}
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={save}>
              Save
            </button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};
