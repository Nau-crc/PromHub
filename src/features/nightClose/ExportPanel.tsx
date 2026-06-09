import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { today } from '@/core/constants';
import { isoDay } from '@/core/utils/date';
import {
  buildExportBlob, downloadBlob, exportFilename,
  type ExportTranslations,
} from './exportXlsx';

// ─────────────────────────────────────────────────────────────
//  Export panel — sits on the Summary tab.
//
//  Range options per spec:
//    - This week (Mon → Sun of current week)
//    - This month (calendar month)
//    - Custom range (date pickers)
//
//  Source: ALWAYS the NightRecord history. Today is included
//  only if it has been closed.
// ─────────────────────────────────────────────────────────────

type RangeKind = 'week' | 'month' | 'custom';

export const ExportPanel: React.FC = () => {
  const { t } = useTranslation();
  const nightRecords = useAppStore((s) => s.nightRecords);

  const [rangeKind, setRangeKind] = useState<RangeKind>('week');
  const [customFrom, setCustomFrom] = useState<string>(isoDay(today()));
  const [customTo, setCustomTo] = useState<string>(isoDay(today()));
  const [working, setWorking] = useState(false);

  const { from, to } = useMemo(
    () => resolveRange(rangeKind, customFrom, customTo),
    [rangeKind, customFrom, customTo],
  );

  const recordsInRange = useMemo(() => {
    return nightRecords
      .filter((r) => r.date >= from && r.date <= to)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [nightRecords, from, to]);

  const doExport = async () => {
    if (!recordsInRange.length) {
      alert(t('export.noRecordsInRange'));
      return;
    }
    setWorking(true);
    try {
      const blob = await buildExportBlob(recordsInRange, makeExportTranslations(t));
      downloadBlob(blob, exportFilename(from, to));
    } catch (err) {
      alert(t('export.failed', { message: (err as Error).message }));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="summary-block" style={{ marginTop: 14 }}>
      <div className="summary-head">{t('export.title')}</div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            type="button"
            className={`tog-btn ${rangeKind === 'week' ? 'on' : ''}`}
            onClick={() => setRangeKind('week')}
          >{t('export.thisWeek')}</button>
          <button
            type="button"
            className={`tog-btn ${rangeKind === 'month' ? 'on' : ''}`}
            onClick={() => setRangeKind('month')}
          >{t('export.thisMonth')}</button>
          <button
            type="button"
            className={`tog-btn ${rangeKind === 'custom' ? 'on' : ''}`}
            onClick={() => setRangeKind('custom')}
          >{t('export.customRange')}</button>
        </div>

        {rangeKind === 'custom' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                {t('components.from')}
              </div>
              <input
                type="date"
                className="form-input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                {t('components.to')}
              </div>
              <input
                type="date"
                className="form-input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        )}

        <div style={{
          fontSize: 12, color: 'var(--color-text-secondary)',
          marginBottom: 10,
        }}>
          {t('export.rangeStatus', {
            count: recordsInRange.length,
            from,
            to,
          })}
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', padding: 12 }}
          onClick={doExport}
          disabled={working || recordsInRange.length === 0}
        >
          {working
            ? t('export.generating')
            : t('export.downloadXlsx')}
        </button>
      </div>
    </div>
  );
};

function resolveRange(
  kind: RangeKind,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  const t = today();
  if (kind === 'week') {
    // ISO-ish Monday → Sunday
    const day = t.getDay(); // 0 = Sun, 1 = Mon, …
    const offsetToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() + offsetToMon);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    return { from: isoDay(mon), to: isoDay(sun) };
  }
  if (kind === 'month') {
    const first = new Date(t.getFullYear(), t.getMonth(), 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    return { from: isoDay(first), to: isoDay(last) };
  }
  // custom — normalise direction so from <= to
  const a = customFrom <= customTo ? customFrom : customTo;
  const b = customFrom <= customTo ? customTo : customFrom;
  return { from: a, to: b };
}

// The XLSX module is locale-agnostic — it asks the caller for the
// label strings. We resolve them here from the active i18n state.
function makeExportTranslations(t: (k: string, opts?: any) => string): ExportTranslations {
  return {
    sheet1Name: t('export.sheet.summary'),
    sheet2Name: t('export.sheet.guests'),
    sheet3Name: t('export.sheet.reservations'),

    hDate: t('export.h.date'),
    hEvents: t('export.h.events'),
    hGuestsPax: t('export.h.guestsPax'),
    hReservations: t('export.h.reservations'),
    hGross: t('export.h.gross'),
    hPaidToInviters: t('export.h.paidToInviters'),
    hNet: t('export.h.net'),
    hInfluencers: t('export.h.influencers'),
    totalsRow: t('export.h.total'),

    hVenue: t('export.h.venue'),
    hEvent: t('export.h.event'),
    hName: t('export.h.name'),
    hInviteType: t('export.h.inviteType'),
    hPax: t('export.h.pax'),
    hSocial: t('export.h.social'),
    hInfluencer: t('export.h.influencer'),
    hArrived: t('export.h.arrived'),
    hWentToClub: t('export.h.wentToClub'),

    hContact: t('export.h.contact'),
    hPhone: t('export.h.phone'),
    hVipType: t('export.h.vipType'),
    hTimeslot: t('export.h.timeslot'),
    hTablePrice: t('export.h.tablePrice'),
    hCommissionPct: t('export.h.commissionPct'),
    hCommissionAmt: t('export.h.commissionAmt'),
    hViaInvitation: t('export.h.viaInvitation'),
    hInviterName: t('export.h.inviterName'),
    hInviterSocial: t('export.h.inviterSocial'),
    hInviterPct: t('export.h.inviterPct'),
    hInviterAmt: t('export.h.inviterAmt'),
    hNetPromoter: t('export.h.netPromoter'),

    yes: t('common.yes'),
    no: t('common.no'),
  };
}
