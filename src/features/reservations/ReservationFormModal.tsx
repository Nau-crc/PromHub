import React, { useEffect, useMemo, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import type { Platform, Reservation } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { COUNTRY_CODES } from '@/core/constants';
import {
  getVipOptionsForPax, getVipPrice, venueById, venueVipSlotsLeft,
} from '@/features/summary/calculations';
import { round2 } from '@/core/utils/format';
import { SheetHeader } from '@/components/SheetHeader';
import { PlatformPicker } from '@/components/PlatformPicker';

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
  const [pax, setPax] = useState<number | ''>('');
  const [vipType, setVipType] = useState<string>('');
  const [slotId, setSlotId] = useState<string>('');
  const [eventId, setEventId] = useState<number | null>(null);
  const [commissionPct, setCommissionPct] = useState<number>(10);
  const [fromInvite, setFromInvite] = useState(false);
  const [inviterPlatform, setInviterPlatform] = useState<Platform>('instagram');
  const [inviterHandle, setInviterHandle] = useState('');
  const [commissionEarner, setCommissionEarner] = useState('');
  const [womanPct, setWomanPct] = useState<number>(50);

  // Hydrate when (re)opening
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setPhoneCode(editing?.phoneCode ?? '+34');
    setPhoneNum(editing?.phoneNum ?? '');
    setVenueId(editing?.venueId ?? venues[0]?.id ?? null);
    setPax(editing?.pax ?? '');
    setVipType(editing?.vipType ?? '');
    setSlotId(editing?.slotId ?? '');
    setEventId(editing ? editing.eventId : (seedEventId ?? null));
    setCommissionPct(editing?.commissionPct ?? 10);
    setFromInvite(!!editing?.fromInvite);
    setInviterPlatform(editing?.inviterPlatform ?? 'instagram');
    setInviterHandle(editing?.inviterHandle ?? '');
    setCommissionEarner(editing?.commissionEarner ?? '');
    setWomanPct(editing?.womanPct ?? 50);
  }, [open, editing, seedEventId, venues]);

  const v = venueId != null ? venueById(venueId, venues) : undefined;
  const paxN = typeof pax === 'number' ? pax : (parseInt(String(pax)) || 0);
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
  const promoter = round2(price * (commissionPct || 0) / 100);
  const woman = fromInvite ? round2(promoter * (womanPct || 0) / 100) : 0;
  const net = round2(promoter - woman);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (venueId == null) return;
    const entry: Reservation = {
      id: editing?.id ?? (nextId('res') as number),
      name: trimmed,
      phoneCode,
      phoneNum: phoneNum.trim(),
      venueId,
      eventId: eventId ?? null,
      vipType,
      slotId,
      pax: typeof pax === 'number' ? pax : (parseInt(String(pax)) || 2),
      fromInvite,
      inviterHandle: fromInvite ? inviterHandle.trim() : '',
      inviterPlatform,
      commissionPct: parseFloat(String(commissionPct)) || 0,
      womanPct: fromInvite ? (parseFloat(String(womanPct)) || 0) : 0,
      commissionEarner: fromInvite ? commissionEarner.trim() : '',
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
              <select className="form-select" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)}>
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
              <input
                className="form-input" type="tel" placeholder="612 345 678"
                value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)}
              />
            </div>
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
              <input
                className="form-input" type="number" min={1} placeholder="# people"
                value={pax}
                onChange={(e) => setPax(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
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

          <div className="form-group">
            <label className="form-label">Your commission %</label>
            <input
              className="form-input" type="number" min={0} max={100}
              value={commissionPct}
              onChange={(e) => setCommissionPct(parseFloat(e.target.value) || 0)}
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
                <input
                  className="form-input" type="number" min={0} max={100}
                  value={womanPct} onChange={(e) => setWomanPct(parseFloat(e.target.value) || 0)}
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
                Your commission ({commissionPct}%): <b style={{ color: '#3B6D11' }}>€{promoter}</b>
                {fromInvite && womanPct > 0 && (
                  <>
                    <br />{(commissionEarner || 'Inviter')}'s cut ({womanPct}%): <b style={{ color: '#F97316' }}>€{woman}</b>
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
