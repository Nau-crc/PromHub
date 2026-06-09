import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { Platform, Reservation } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { COUNTRY_CODES } from '@/core/constants';
import {
  findEventsAt, getVipOptionsForPax, getVipPrice, nextOccurrence,
  venueById, venueVipSlotsLeft,
} from '@/features/summary/calculations';
import { round2 } from '@/core/utils/format';
import { isoDay } from '@/core/utils/date';
import { today } from '@/core/constants';
import { SheetHeader } from '@/components/SheetHeader';
import { PlatformPicker } from '@/components/PlatformPicker';
import { NumberField } from '@/components/NumberField';
import { TimePicker } from '@/components/TimePicker';
import { SelectField } from '@/components/SelectField';
import { formatPhone, isValidPhone, maxDigits, onlyDigits, placeholderForCode } from '@/core/utils/phone';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Reservation | null;
  seedEventId?: number;
}

export const ReservationFormModal: React.FC<Props> = ({ open, onClose, editing, seedEventId }) => {
  const { t } = useTranslation();
  const { venues, events, reservations, upsertReservation, removeReservation } = useAppStore((s) => ({
    venues: s.venues, events: s.events, reservations: s.reservations,
    upsertReservation: s.upsertReservation, removeReservation: s.removeReservation,
  }));
  const confirm = useConfirm();

  const askDelete = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: t('reservationForm.deleteTitle', { name: editing.name }),
      confirmLabel: t('actions.delete'),
      destructive: true,
    });
    if (ok) { removeReservation(editing.id); onClose(); }
  };

  const [name, setName] = useState('');
  const [phoneCode, setPhoneCode] = useState('+34');
  const [phoneNum, setPhoneNum] = useState('');
  const [venueId, setVenueId] = useState<number | null>(null);
  const [pax, setPax] = useState<number | null>(null);
  const [vipType, setVipType] = useState<string>('');
  const [eventDate, setEventDate] = useState<string>('');
  const [time, setTime] = useState<string>('20:00');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [commissionPct, setCommissionPct] = useState<number | null>(10);
  const [fromInvite, setFromInvite] = useState(false);
  const [inviterPlatform, setInviterPlatform] = useState<Platform>('instagram');
  const [inviterHandle, setInviterHandle] = useState('');
  const [commissionEarner, setCommissionEarner] = useState('');
  const [womanPct, setWomanPct] = useState<number | null>(50);

  // Hydrate when (re)opening — guarded by an init key so background
  // poll-driven `venues` updates don't refire the effect and wipe
  // whatever the user has just typed. Runs once per open session, or
  // again whenever the editing target / seeded event changes.
  const initKey = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { initKey.current = null; return; }
    const key = editing?.id != null
      ? `edit-${editing.id}`
      : `new-${seedEventId ?? 'none'}`;
    if (initKey.current === key) return;
    initKey.current = key;
    setName(editing?.name ?? '');
    setPhoneCode(editing?.phoneCode ?? '+34');
    setPhoneNum(editing?.phoneNum ?? '');
    const initVid = editing?.venueId ?? (seedEventId
      ? events.find((e) => e.id === seedEventId)?.venueId ?? venues[0]?.id ?? null
      : venues[0]?.id ?? null);
    setVenueId(initVid);
    setPax(editing?.pax ?? null);
    setVipType(editing?.vipType ?? '');
    setEventDate(editing?.eventDate ?? defaultEventNight(initVid));
    setTime(editing?.time ?? '20:00');
    setCommissionPct(editing?.commissionPct ?? 10);
    setFromInvite(!!editing?.fromInvite);
    setInviterPlatform(editing?.inviterPlatform ?? 'instagram');
    setInviterHandle(editing?.inviterHandle ?? '');
    setCommissionEarner(editing?.commissionEarner ?? '');
    setWomanPct(editing?.womanPct ?? 50);
  }, [open, editing, seedEventId, venues]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Event nights at the selected venue ────────────────────
  // Per the data model a reservation belongs to a VENUE, not an event.
  // We still surface "upcoming nights with an event here" so the
  // promoter can pick a date in one tap. The eventId stays nullable
  // for context — useful when reporting later — but is not required.
  const todayIso = isoDay(today());
  const eventNightsAtVenue = useMemo(() => {
    if (venueId == null) return [];
    const out: { iso: string; events: typeof events }[] = [];
    const seen = new Map<string, typeof events>();
    for (const e of events) {
      if (e.venueId !== venueId) continue;
      // Look ahead 90 days for occurrences
      let cursor = todayIso;
      for (let i = 0; i < 90; i++) {
        const next = nextOccurrence(e, cursor);
        if (!next || (e.seasonEnd && next > e.seasonEnd)) break;
        const arr = seen.get(next) ?? [];
        if (!arr.find((x) => x.id === e.id)) arr.push(e);
        seen.set(next, arr);
        // step one day after the occurrence to find the next
        const [y, m, d] = next.split('-').map(Number);
        cursor = isoDay(new Date(y, m - 1, d + 1));
      }
    }
    [...seen.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .forEach(([iso, evs]) => out.push({ iso, events: evs }));
    return out;
  }, [venueId, events, todayIso]);

  function defaultEventNight(vid: number | null): string {
    if (vid == null) return '';
    // First upcoming event night, or empty if none
    let earliest = '';
    for (const e of events) {
      if (e.venueId !== vid) continue;
      const next = nextOccurrence(e, todayIso);
      if (next && (!earliest || next < earliest)) earliest = next;
    }
    return earliest;
  }

  // When the venue changes, reset the date to its first event night
  useEffect(() => {
    setEventDate((prev) => prev || defaultEventNight(venueId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  const paxN = pax ?? 0;
  const vipOpts = useMemo(
    () => (venueId != null ? getVipOptionsForPax(venueId, paxN, venues) : []),
    [venueId, paxN, venues],
  );
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

  // ── Event overlap banner ──────────────────────────────────
  // Reservations are independent of events, but we surface any
  // event scheduled at the venue at this date/time so the promoter
  // knows the room is busy. Purely informational.
  const eventsAtThisTime = useMemo(
    () => findEventsAt(venueId, eventDate, time, events, venues),
    [venueId, eventDate, time, events, venues],
  );

  // ── Live commission preview (mirrors `previewComm` byte-for-byte) ──
  const price = venueId != null ? getVipPrice(venueId, vipType, venues) : 0;
  const commissionPctN = commissionPct ?? 0;
  const womanPctN = womanPct ?? 0;
  const promoter = round2(price * commissionPctN / 100);
  const woman = fromInvite ? round2(promoter * womanPctN / 100) : 0;
  const net = round2(promoter - woman);

  const phoneDigits = onlyDigits(phoneNum);
  const phoneOk = !phoneDigits || isValidPhone(phoneCode, phoneDigits);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { alert(t('reservationForm.errNameRequired')); return; }
    if (venueId == null) { alert(t('reservationForm.errPickVenue')); return; }
    if (!pax || pax < 1) { alert(t('reservationForm.errPaxRequired')); return; }
    if (!vipType) { alert(t('reservationForm.errPickVipType')); return; }
    if (!eventDate) { alert(t('eventForm.errPickDate')); return; }
    if (phoneDigits && !phoneOk) {
      alert(t('venueForm.errPhoneFmt', { code: phoneCode }));
      return;
    }
    const entry = {
      ...(editing?.id != null ? { id: editing.id } : {}),
      name: trimmed,
      phoneCode,
      phoneNum: phoneNum.trim(),
      venueId,
      vipType,
      // slotId is deprecated — leave it empty for new records.
      slotId: editing?.slotId ?? '',
      time: time || '20:00',
      pax: pax ?? 2,
      fromInvite,
      inviterHandle: fromInvite ? inviterHandle.trim() : '',
      inviterPlatform,
      commissionPct: commissionPctN,
      womanPct: fromInvite ? womanPctN : 0,
      commissionEarner: fromInvite ? commissionEarner.trim() : '',
      createdAt: editing?.createdAt ?? isoDay(today()),
      eventDate: eventDate || null,
      // Event link is informational only; we attach it when the user picked
      // a date that has an event scheduled at this venue.
      eventId: (() => {
        const night = eventNightsAtVenue.find((n) => n.iso === eventDate);
        return night?.events[0]?.id ?? null;
      })(),
    };
    try {
      await upsertReservation(entry as Reservation | Omit<Reservation, 'id'>);
      onClose();
    } catch (err) {
      alert(t('reservationForm.couldntSave', { message: (err as Error).message }));
    }
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <IonContent>
        <SheetHeader title={editing ? t('reservationForm.titleEdit') : t('reservationForm.titleNew')} onClose={onClose} />
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="form-group">
            <label className="form-label">{t('reservationForm.contactName')}</label>
            <input className="form-input" placeholder={t('guestForm.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">{t('reservationForm.phone')}</label>
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

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('reservationForm.venue')} *</label>
              <SelectField
                value={venueId}
                onChange={(v) => setVenueId(Number(v))}
                title={t('common.pickAVenue')}
                placeholder={t('actions.selectVenue')}
                options={venues.map((vv) => ({ value: vv.id, label: vv.name }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('reservationForm.pax')}</label>
              <NumberField
                className="form-input" min={1} placeholder={t('reservationForm.paxPlaceholder')}
                value={pax} onChange={setPax}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">VIP *</label>
              <SelectField
                value={vipType || null}
                onChange={(v) => setVipType(String(v))}
                title="VIP"
                placeholder={vipOpts.length ? '— VIP —' : '—'}
                disabled={!vipOpts.length}
                options={vipOpts.map((t) => {
                  const left = venueVipSlotsLeft(venueId!, t.name, venues, reservations);
                  const cap = t.tableCapacity || 0;
                  return {
                    value: t.name,
                    label: `${t.name} · €${t.price}`,
                    sub: `${t.minPax}–${t.maxPax} pax${cap ? ` · ${left}/${cap} tables left` : ''}`,
                    disabled: cap > 0 && left === 0,
                  };
                })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('reservationForm.time')}</label>
              <button
                type="button"
                className="form-input"
                style={{ textAlign: 'center', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}
                onClick={() => setTimePickerOpen(true)}
              >
                {time || '20:00'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('reservationForm.eventNight')} *</label>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              {t('reservationForm.pickEventNightHint')}
            </div>
            {eventNightsAtVenue.length ? (
              <div>
                {eventNightsAtVenue.slice(0, 12).map(({ iso, events: evs }) => {
                  const on = eventDate === iso;
                  const dt = new Date(iso + 'T00:00:00');
                  const label = dt.toLocaleDateString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric',
                  });
                  return (
                    <div
                      key={iso}
                      className={`event-picker-item ${on ? 'sel' : ''}`}
                      onClick={() => setEventDate(iso)}
                    >
                      <div className="event-picker-info">
                        <div className="event-picker-name">{label}</div>
                        <div className="event-picker-sub">
                          {evs.map((e) => e.name).join(' · ')}
                        </div>
                      </div>
                      <div className="event-picker-check">{on ? '✓' : ''}</div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '8px 0 4px' }}>
              {t('common.pickADate')}:
            </div>
            <input
              className="form-input"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          {eventsAtThisTime.length > 0 && (
            <div className="info-box" style={{
              borderLeft: '3px solid var(--color-primary)',
              background: 'rgba(249, 115, 22, .08)',
              color: 'var(--color-text-primary)',
            }}>
              ℹ️ {eventsAtThisTime.length === 1 ? 'There is an event' : 'There are events'} at this venue at this time:
              <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                {eventsAtThisTime.map((m, i) => (
                  <li key={i} style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <b>{m.event.name}</b> · {m.slotName} ({m.startTime}–{m.endTime})
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 6 }}>
                The reservation isn't linked to {eventsAtThisTime.length === 1 ? 'it' : 'them'} — this is just a heads-up.
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('reservationForm.yourCommission')}</label>
            <NumberField
              className="form-input" min={0} max={100} decimal
              value={commissionPct} onChange={setCommissionPct}
            />
          </div>

          <div className="check-row">
            <input id="rFromInv" type="checkbox" checked={fromInvite} onChange={(e) => setFromInvite(e.target.checked)} />
            <label htmlFor="rFromInv">{t('reservationForm.viaInvitation')}</label>
          </div>

          {fromInvite && (
            <>
              <div className="info-box">{t('reservationForm.viaInviteInfo')}</div>
              <div className="form-group">
                <label className="form-label">{t('reservationForm.inviterPlatform')}</label>
                <PlatformPicker value={inviterPlatform} onChange={setInviterPlatform} />
                <input
                  className="form-input" placeholder={t('reservationForm.inviterHandle')}
                  value={inviterHandle} onChange={(e) => setInviterHandle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('reservationForm.inviterName')}</label>
                <input className="form-input" placeholder={t('guestForm.namePlaceholder')}
                  value={commissionEarner} onChange={(e) => setCommissionEarner(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('reservationForm.inviterPct')}</label>
                <NumberField
                  className="form-input" min={0} max={100} decimal
                  value={womanPct} onChange={setWomanPct}
                />
              </div>
            </>
          )}

          <div className="comm-breakdown">
            {price > 0 && (
              <>
                €{price} · {paxN || 1} {t('common.paxShort')}<br />
                {t('reservationForm.yourCommission')} ({commissionPctN}%): <b style={{ color: '#3B6D11' }}>€{promoter}</b>
                {fromInvite && womanPctN > 0 && (
                  <>
                    <br />{commissionEarner || '—'} ({womanPctN}%): <b style={{ color: '#F97316' }}>€{woman}</b>
                    <br />{t('reservationForm.netToYou')}: <b style={{ color: '#3B6D11' }}>€{net}</b>
                  </>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {editing && (
              <button className="btn-danger" onClick={askDelete}>
                {t('actions.delete')}
              </button>
            )}
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={save}>
              {t('actions.save')}
            </button>
          </div>
        </div>
        <TimePicker
          open={timePickerOpen}
          value={time || '20:00'}
          onClose={() => setTimePickerOpen(false)}
          onChange={(t) => setTime(t)}
          title="Reservation time"
        />
      </IonContent>
    </IonModal>
  );
};
