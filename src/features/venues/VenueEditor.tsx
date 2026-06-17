import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Timeslot, VipType } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { PaxStepper } from '@/components/PaxStepper';
import { NumberField } from '@/components/NumberField';
import { TimePicker } from '@/components/TimePicker';

// ── TimeslotRows ────────────────────────────────────────────
interface TsRowsProps {
  rows: Timeslot[];
  setRows: (rows: Timeslot[]) => void;
}
export const TimeslotRows: React.FC<TsRowsProps> = ({ rows, setRows }) => {
  const { t } = useTranslation();
  const nextId = useAppStore((s) => s.nextId);
  const [openPicker, setOpenPicker] = useState<{ idx: number; field: 'startTime' | 'endTime' } | null>(null);
  const update = (i: number, patch: Partial<Timeslot>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const add = () =>
    setRows([
      ...rows,
      {
        id: nextId('ts') as string,
        name: '',
        startTime: '20:00',
        endTime: '00:00',
        guestCapacity: 0,
      },
    ]);

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label className="form-label" style={{ margin: 0 }}>{t('venueEditor.timeslots')}</label>
        <button type="button" className="btn-sm" onClick={add}>{t('venueEditor.addTimeslot')}</button>
      </div>
      {!rows.length && (
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '4px 0' }}>
          {t('venueEditor.noTimeslots')}
        </div>
      )}
      {rows.map((r, i) => (
        <div className="ts-block" key={r.id}>
          <div className="ts-block-head">
            <input
              className="ts-block-name"
              placeholder={t('venueEditor.timeslotPlaceholder')}
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button type="button" className="row-del-btn" aria-label={t('actions.delete')} onClick={() => remove(i)}>✕</button>
          </div>
          <div className="ts-block-row">
            <div>
              <div className="ts-label">{t('venueEditor.start24h')}</div>
              <button
                type="button"
                className="form-input"
                style={{ fontSize: 13, padding: '9px 8px', textAlign: 'center', cursor: 'pointer' }}
                onClick={() => setOpenPicker({ idx: i, field: 'startTime' })}
              >
                {r.startTime}
              </button>
            </div>
            <div>
              <div className="ts-label">{t('venueEditor.end24h')}</div>
              <button
                type="button"
                className="form-input"
                style={{ fontSize: 13, padding: '9px 8px', textAlign: 'center', cursor: 'pointer' }}
                onClick={() => setOpenPicker({ idx: i, field: 'endTime' })}
              >
                {r.endTime}
              </button>
            </div>
            <div>
              <div className="ts-label">{t('venueEditor.guestCap')}</div>
              <NumberField
                className="form-input"
                style={{ fontSize: 13, padding: '9px 8px' }}
                placeholder="—"
                min={0}
                value={r.guestCapacity || null}
                onChange={(v) => update(i, { guestCapacity: v ?? 0 })}
              />
            </div>
          </div>
        </div>
      ))}
      <TimePicker
        open={openPicker !== null}
        value={openPicker ? rows[openPicker.idx]?.[openPicker.field] ?? '20:00' : '20:00'}
        title={openPicker?.field === 'endTime' ? t('venueEditor.end24h') : t('venueEditor.start24h')}
        onClose={() => setOpenPicker(null)}
        onChange={(v) => {
          if (openPicker) update(openPicker.idx, { [openPicker.field]: v });
        }}
      />
    </div>
  );
};

// ── VipRows ────────────────────────────────────────────────
interface VipRowsProps {
  rows: VipType[];
  setRows: (rows: VipType[]) => void;
}
export const VipRows: React.FC<VipRowsProps> = ({ rows, setRows }) => {
  const { t } = useTranslation();
  const nextId = useAppStore((s) => s.nextId);
  const update = (i: number, patch: Partial<VipType>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const add = () =>
    setRows([
      ...rows,
      {
        id: nextId('vip') as string,
        name: '',
        minPax: 1,
        maxPax: 10,
        tableCapacity: 5,
      },
    ]);

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label className="form-label" style={{ margin: 0 }}>{t('venueEditor.vipTypes')}</label>
        <button type="button" className="btn-sm" onClick={add}>{t('venueEditor.addVip')}</button>
      </div>
      {!rows.length && (
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '4px 0' }}>
          {t('venueEditor.noVipTypes')}
        </div>
      )}
      {rows.map((r, i) => (
        <div className="vip-block" key={r.id}>
          <div className="vip-block-head">
            <input
              className="vip-block-name"
              placeholder={t('venueEditor.vipPlaceholder')}
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button type="button" className="row-del-btn" aria-label={t('actions.delete')} onClick={() => remove(i)}>✕</button>
          </div>
          <div className="vip-block-row">
            <div>
              <div className="vip-sub-label">{t('venueEditor.paxRange')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <NumberField
                  className="form-input"
                  style={{ fontSize: 13, padding: '9px 6px', width: 48, textAlign: 'center' }}
                  title="Min pax"
                  min={1}
                  value={r.minPax || null}
                  onChange={(v) => update(i, { minPax: v ?? 0 })}
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>–</span>
                <NumberField
                  className="form-input"
                  style={{ fontSize: 13, padding: '9px 6px', width: 48, textAlign: 'center' }}
                  title="Max pax"
                  min={1}
                  value={r.maxPax || null}
                  onChange={(v) => update(i, { maxPax: v ?? 0 })}
                />
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 3, textAlign: 'center' }}>
                min &nbsp;–&nbsp; max
              </div>
            </div>
            <div>
              <div className="vip-sub-label">{t('venueEditor.tablesAvailable')}</div>
              <div style={{ marginTop: 2 }}>
                <PaxStepper
                  value={r.tableCapacity || 0}
                  onChange={(v) => update(i, { tableCapacity: v })}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// (InviteTypeRows removed — guests now choose from the event's
//  selected timeslots in the guest form, no separate per-venue
//  invite-type list to manage.)
