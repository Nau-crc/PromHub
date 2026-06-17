import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { PromEvent, Timeslot } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { isoDay, todayWeekday } from '@/core/utils/date';
import { today } from '@/core/constants';
import { DayChips } from '@/components/DayChips';
import { SheetHeader } from '@/components/SheetHeader';
import { NumberField } from '@/components/NumberField';
import { Calendar } from '@/components/Calendar';
import { SelectField } from '@/components/SelectField';
import { safeUuid } from '@/core/utils/format';
import { TimeslotRows } from '@/features/venues/VenueEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: PromEvent | null;
  onRequestNewVenue?: () => void;
}

const NO_VENUE = '__none__';
const NEW_VENUE = '__new__';

export const EventFormModal: React.FC<Props> = ({ open, onClose, editing, onRequestNewVenue }) => {
  const { t } = useTranslation();
  const { venues, upsertEvent, removeEvent } = useAppStore((s) => ({
    venues: s.venues,
    upsertEvent: s.upsertEvent,
    removeEvent: s.removeEvent,
  }));
  const confirm = useConfirm();

  const askDelete = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: t('eventForm.deleteTitle', { name: editing.name }),
      message: t('eventForm.deleteMessage'),
      confirmLabel: t('actions.delete'),
      destructive: true,
    });
    if (ok) { removeEvent(editing.id); onClose(); }
  };

  const [name, setName] = useState('');
  const [venueId, setVenueId] = useState<number | null>(null);
  const [isOneTime, setIsOneTime] = useState(false);
  const [eventDate, setEventDate] = useState<string>('');
  const [days, setDays] = useState<string[]>([]);
  /** Event-owned timeslot definitions (moved from venue in 0008). */
  const [tsRows, setTsRows] = useState<Timeslot[]>([]);
  /** Per-event VIP prices, keyed by VIP type NAME. The venue owns
   *  the type identity + table capacity; the event picks the price. */
  const [vipPrices, setVipPrices] = useState<Record<string, number>>({});
  const [desc, setDesc] = useState('');
  const [isPriv, setPriv] = useState(false);
  const [isLate, setLate] = useState(false);
  /** Minimum pax required on a single occurrence to earn the fixed
   *  fee. Stays null when the event has no fee logic. */
  const [minGuestsThreshold, setMinGuestsThreshold] = useState<number | null>(null);
  /** Fixed € amount earned when threshold is met. */
  const [fixedFee, setFixedFee] = useState<number | null>(null);
  const [seasonStart, setSeasonStart] = useState<string>('');
  const [seasonEnd, setSeasonEnd] = useState<string>('');

  // Init-once-per-open guard. Without this, the effect's `venues`
  // dependency would re-fire every time the background poll refreshes
  // the store — wiping anything the user has just typed. We track an
  // "init key" that uniquely identifies the entity we opened on; the
  // effect only re-runs when that key actually changes. Reset on close.
  const initKey = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { initKey.current = null; return; }
    const key = editing?.id != null ? `edit-${editing.id}` : 'new';
    if (initKey.current === key) return;
    initKey.current = key;
    setName(editing?.name ?? '');
    setVenueId(editing?.venueId ?? venues[0]?.id ?? null);
    setIsOneTime(!!editing?.isOneTime);
    setEventDate(editing?.eventDate ?? isoDay(today()));
    setDays(editing && !editing.isOneTime
      ? (editing.weekdays || [editing.weekday]).filter(Boolean)
      : [todayWeekday()]);
    setTsRows(editing ? [...(editing.timeslots || [])] : []);
    setVipPrices(editing ? { ...(editing.vipPrices || {}) } : {});
    setDesc(editing?.description ?? '');
    setPriv(!!editing?.isPrivate);
    setLate(!!editing?.isLateClub);
    setMinGuestsThreshold(editing?.minGuestsThreshold ?? null);
    setFixedFee(editing?.fixedFee ?? null);
    setSeasonStart(editing?.seasonStart ?? '');
    setSeasonEnd(editing?.seasonEnd ?? '');
  }, [open, editing, venues]);

  const onVenueChange = (val: string) => {
    if (val === NEW_VENUE) {
      onRequestNewVenue?.();
      return;
    }
    if (val === NO_VENUE || val === '') {
      setVenueId(null);
      return;
    }
    setVenueId(parseInt(val));
  };

  // VIP types come from the SELECTED venue (identity + capacity);
  // their prices are kept locally on the event. When the venue
  // changes, prices for VIP types no longer relevant get dropped
  // implicitly because they're keyed by name.
  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === venueId) ?? null,
    [venues, venueId],
  );
  const vipTypeNames = (selectedVenue?.vipTypes ?? []).map((vt) => vt.name);

  const toggleDay = (d: string) =>
    setDays((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]));

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { alert(t('eventForm.errNameRequired')); return; }

    if (isOneTime) {
      if (!eventDate) { alert(t('eventForm.errPickDate')); return; }
    } else {
      if (!days.length) { alert(t('eventForm.errSelectDay')); return; }
      if (seasonStart && seasonEnd && seasonEnd < seasonStart) {
        alert(t('eventForm.errSeasonOrder'));
        return;
      }
    }

    // Fixed-fee pair check: must both be set or both empty. A lone
    // threshold or lone fee would be ambiguous server-side.
    const hasThreshold = !!minGuestsThreshold && minGuestsThreshold > 0;
    const hasFee = fixedFee != null && fixedFee > 0;
    if (hasThreshold !== hasFee) {
      alert(t('eventForm.errFixedFeePair'));
      return;
    }

    // At least one timeslot defined.
    const cleanSlots = tsRows
      .filter((r) => r.name.trim())
      .map((r) => ({
        ...r,
        name: r.name.trim(),
        guestCapacity: r.guestCapacity || 0,
      }));
    if (!cleanSlots.length) {
      alert(t('eventForm.errSelectSlot'));
      return;
    }

    // Strip prices for VIP types that no longer exist on the venue.
    const cleanPrices: Record<string, number> = {};
    for (const name of vipTypeNames) {
      const p = vipPrices[name];
      if (typeof p === 'number' && p > 0) cleanPrices[name] = p;
    }

    // Every event gets a public-share token at creation time.
    const shareToken = editing?.shareToken ?? safeUuid();

    const entry = {
      ...(editing?.id != null ? { id: editing.id } : {}),
      name: trimmed,
      venueId,
      weekdays: isOneTime ? [] : [...days],
      weekday: isOneTime ? '' : days[0],
      description: desc.trim(),
      videoUrl: '',
      isPrivate: isPriv,
      isLateClub: isLate,
      invitedGuests: editing?.invitedGuests ?? [],
      isOneTime,
      eventDate: isOneTime ? eventDate : null,
      timeslots: cleanSlots,
      vipPrices: cleanPrices,
      minGuestsThreshold: hasThreshold ? minGuestsThreshold : null,
      fixedFee: hasFee ? fixedFee : null,
      seasonStart: !isOneTime && seasonStart ? seasonStart : null,
      seasonEnd: !isOneTime && seasonEnd ? seasonEnd : null,
      shareToken,
    };

    // The event row itself carries the `shareToken` column, so
    // upserting the event IS the publish — no second backend call
    // needed. /api/event resolves the token by reading `events`.
    try {
      await upsertEvent(entry as PromEvent | Omit<PromEvent, 'id'>);
      onClose();
    } catch (err) {
      alert(t('eventForm.couldntSave', { message: (err as Error).message }));
    }
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <IonContent>
        <SheetHeader title={editing ? t('eventForm.titleEdit') : t('eventForm.titleNew')} onClose={onClose} />
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="form-group">
            <label className="form-label">{t('eventForm.name')}</label>
            <input className="form-input" placeholder={t('eventForm.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">{t('eventForm.venue')}</label>
            <SelectField
              value={venueId == null ? NO_VENUE : String(venueId)}
              onChange={(v) => onVenueChange(v)}
              title={t('common.pickAVenue')}
              options={[
                { value: NO_VENUE, label: t('eventForm.noVenueOption') },
                ...venues.map((v) => ({ value: String(v.id), label: v.name })),
                { value: NEW_VENUE, label: t('eventForm.newVenue') },
              ]}
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
                  <div className="form-label" style={{ marginBottom: 6 }}>
                    {t('eventForm.season')}
                  </div>
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => { setSeasonStart(''); setSeasonEnd(''); }}
                    >
                      {t('eventForm.clearRange')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Timeslots (event-owned) ─────────────────────────
              Slots are now defined HERE — each event sets its own
              timeslots and per-slot capacity. The per-night cap is
              the sum of these capacities. */}
          <TimeslotRows rows={tsRows} setRows={setTsRows} />

          {/* ── VIP prices for this event ──────────────────────
              The venue declares which VIP types exist (identity +
              table capacity); the event sets a € price per type. */}
          {venueId != null && vipTypeNames.length > 0 && (
            <div className="form-group">
              <label className="form-label">{t('eventForm.vipPricesSection')}</label>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                {t('eventForm.vipPricesHint')}
              </div>
              {vipTypeNames.map((name) => (
                <div key={name} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0',
                }}>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)' }}>
                    {name}
                  </div>
                  <div style={{ width: 110 }}>
                    <NumberField
                      className="form-input"
                      style={{ textAlign: 'right' }}
                      placeholder="€0"
                      min={0}
                      decimal
                      value={vipPrices[name] ?? null}
                      onChange={(v) =>
                        setVipPrices((m) => ({ ...m, [name]: v ?? 0 }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Fixed-fee block ────────────────────────────────
              The promoter optionally sets "bring at least N people
              → earn €M". Both fields are paired: leaving one blank
              hides the fee logic entirely for this event. */}
          <div className="form-group">
            <label className="form-label">{t('eventForm.fixedFeeSection')}</label>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
              {t('eventForm.fixedFeeHint')}
            </div>
            <div className="form-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  {t('eventForm.minGuestsLabel')}
                </div>
                <NumberField
                  className="form-input"
                  placeholder={t('eventForm.minGuestsPlaceholder')}
                  min={1}
                  value={minGuestsThreshold}
                  onChange={setMinGuestsThreshold}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  {t('eventForm.fixedFeeLabel')}
                </div>
                <NumberField
                  className="form-input"
                  placeholder={t('eventForm.fixedFeePlaceholder')}
                  min={0}
                  decimal
                  value={fixedFee}
                  onChange={setFixedFee}
                />
              </div>
            </div>
            {(minGuestsThreshold || fixedFee) && (
              <div style={{
                fontSize: 11, marginTop: 6,
                color: minGuestsThreshold && fixedFee
                  ? 'var(--color-text-secondary)'
                  : 'var(--color-danger)',
              }}>
                {minGuestsThreshold && fixedFee
                  ? t('eventForm.fixedFeePreview', {
                      threshold: minGuestsThreshold,
                      amount: Number(fixedFee).toFixed(2),
                    })
                  : t('eventForm.errFixedFeePair')}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t('eventForm.description')}</label>
            <textarea className="form-textarea" placeholder={t('eventForm.descPlaceholder')} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="check-row">
            <input id="evPrivate" type="checkbox" checked={isPriv} onChange={(e) => setPriv(e.target.checked)} />
            <label htmlFor="evPrivate">{t('eventForm.privateLabel')}</label>
          </div>
          <div className="check-row">
            <input id="evLate" type="checkbox" checked={isLate} onChange={(e) => setLate(e.target.checked)} />
            <label htmlFor="evLate">{t('eventForm.lateClubLabel')}</label>
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
      </IonContent>
    </IonModal>
  );
};
