import React, { useEffect, useRef, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { PromEvent } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { isoDay, todayWeekday } from '@/core/utils/date';
import { today } from '@/core/constants';
import { DayChips } from '@/components/DayChips';
import { SlotChips } from '@/components/SlotChips';
import { SheetHeader } from '@/components/SheetHeader';
import { NumberField } from '@/components/NumberField';
import { Calendar } from '@/components/Calendar';
import { SelectField } from '@/components/SelectField';
import { safeUuid } from '@/core/utils/format';

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
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [desc, setDesc] = useState('');
  const [isPriv, setPriv] = useState(false);
  const [isLate, setLate] = useState(false);
  const [capacity, setCapacity] = useState<number | null>(null);
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
    const initV = venues.find((v) => v.id === (editing?.venueId ?? venues[0]?.id));
    setSlotIds(
      editing
        ? [...(editing.selectedSlotIds || [])]
        : initV?.timeslots?.length ? [initV.timeslots[0].id] : [],
    );
    setDesc(editing?.description ?? '');
    setPriv(!!editing?.isPrivate);
    setLate(!!editing?.isLateClub);
    setCapacity(editing?.capacity ?? null);
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
      setSlotIds([]); // no venue → no timeslots
      return;
    }
    const id = parseInt(val);
    setVenueId(id);
    const v = venues.find((x) => x.id === id);
    setSlotIds(v?.timeslots?.length ? [v.timeslots[0].id] : []);
  };

  const toggleDay = (d: string) =>
    setDays((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]));

  const toggleSlot = (id: string) =>
    setSlotIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

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

    // Timeslots only required when a venue is set (otherwise the event has none)
    if (venueId != null && !slotIds.length) {
      alert(t('eventForm.errSelectSlot'));
      return;
    }

    // Every event gets a public-share token at creation time. Existing
    // events keep their token; new ones get a fresh UUID v4.
    const shareToken = editing?.shareToken ?? safeUuid();

    const entry = {
      ...(editing?.id != null ? { id: editing.id } : {}),
      name: trimmed,
      venueId,
      weekdays: isOneTime ? [] : [...days],
      weekday: isOneTime ? '' : days[0],
      selectedSlotIds: venueId != null ? [...slotIds] : [],
      description: desc.trim(),
      videoUrl: '',
      isPrivate: isPriv,
      isLateClub: isLate,
      invitedGuests: editing?.invitedGuests ?? [],
      isOneTime,
      eventDate: isOneTime ? eventDate : null,
      capacity: capacity && capacity > 0 ? capacity : null,
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

          {venueId != null && (
            <div className="form-group">
              <label className="form-label">{t('eventForm.timeslots')}</label>
              <SlotChips venueId={venueId} selected={slotIds} onToggle={toggleSlot} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('eventForm.capacity')}</label>
            <NumberField
              className="form-input"
              placeholder={t('eventForm.capacityPlaceholder')}
              min={0}
              value={capacity}
              onChange={setCapacity}
            />
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
