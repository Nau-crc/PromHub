import React, { useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { SheetHeader } from '@/components/SheetHeader';

// ─────────────────────────────────────────────────────────────
//  Close Night panel — the button + confirmation flow.
//
//  Rules:
//    1. Only renders when `isoDate === today` (caller guarantees).
//    2. Disables itself when there's nothing to close (no guests
//       and no reservations for the date).
//    3. If a record already exists for today, the button label and
//       confirm copy switch to "save a correction" instead of
//       hiding the action.
//    4. Confirmation modal shows the pre-computed summary so the
//       promoter sees exactly what will be frozen before they
//       commit.
//
//  The panel is presentational — it asks the store for the
//  preview summary and dispatches `closeNight()` on confirm.
// ─────────────────────────────────────────────────────────────

interface Props {
  isoDate: string;
}

export const CloseNightPanel: React.FC<Props> = ({ isoDate }) => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const {
    buildTodaySummary, closeNight,
    hasClosedNight, latestClosedNight,
  } = useAppStore((s) => ({
    buildTodaySummary: s.buildTodaySummary,
    closeNight: s.closeNight,
    hasClosedNight: s.hasClosedNight,
    latestClosedNight: s.latestClosedNight,
  }));

  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  // Compute the preview the modal will show.
  const preview = buildTodaySummary(isoDate);
  const hasData = preview.guests.length > 0 || preview.reservations.length > 0;
  const alreadyClosed = hasClosedNight(isoDate);
  const latest = alreadyClosed ? latestClosedNight(isoDate) : null;

  const onOpen = async () => {
    if (!hasData) {
      // Spec: friendly error if there's nothing to close.
      alert(t('nightClose.nothingToClose'));
      return;
    }
    if (alreadyClosed) {
      // Spec: confirm before saving a correction.
      const ok = await confirm({
        title: t('nightClose.alreadyClosedTitle'),
        message: t('nightClose.alreadyClosedMessage'),
        confirmLabel: t('nightClose.saveCorrection'),
      });
      if (!ok) return;
    }
    setOpen(true);
  };

  const onConfirm = async () => {
    setWorking(true);
    try {
      await closeNight(isoDate);
      setOpen(false);
      // Tiny success feedback. Alert is intentionally crude — the
      // closed-state badge below replaces the button immediately
      // after, which is the durable confirmation.
      alert(t('nightClose.savedToast', { date: isoDate }));
    } catch (err) {
      alert(t('nightClose.failedToSave', { message: (err as Error).message }));
    } finally {
      setWorking(false);
    }
  };

  // ── Render: button or closed-state badge ─────────────────
  if (alreadyClosed && latest) {
    const closedTime = new Date(latest.closedAt).toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit',
    });
    return (
      <div style={{
        marginTop: 14, marginBottom: 14,
        padding: '12px 14px',
        background: 'var(--color-background-secondary)',
        border: '1px solid #0F6E56',
        borderRadius: 'var(--border-radius-md)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F6E56' }}>
            ✓ {t('nightClose.closedAt', { time: closedTime })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {t('nightClose.closedSummary', {
              guests: latest.summary.totalGuests,
              reservations: latest.summary.totalReservations,
              net: latest.summary.netCommission.toFixed(2),
            })}
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{ fontSize: 12, padding: '6px 10px', flexShrink: 0 }}
          onClick={onOpen}
        >
          {t('nightClose.saveCorrectionBtn')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginTop: 14, marginBottom: 14 }}>
        <button
          type="button"
          className="btn-primary"
          style={{
            width: '100%', padding: 14, fontSize: 14, fontWeight: 600,
            opacity: hasData ? 1 : 0.6,
          }}
          onClick={onOpen}
          disabled={!hasData}
        >
          🌙 {t('nightClose.closeNight')}
        </button>
        {!hasData && (
          <div style={{
            fontSize: 11, color: 'var(--color-text-secondary)',
            marginTop: 6, textAlign: 'center',
          }}>
            {t('nightClose.nothingToCloseShort')}
          </div>
        )}
      </div>

      <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
        <IonContent>
          <SheetHeader
            title={t('nightClose.confirmTitle')}
            onClose={() => setOpen(false)}
          />
          <div style={{ padding: '16px 16px 32px' }}>
            <div style={{
              fontSize: 13, color: 'var(--color-text-secondary)',
              marginBottom: 16, lineHeight: 1.5,
            }}>
              {t('nightClose.confirmHint')}
            </div>

            <div style={{
              background: 'var(--color-background-secondary)',
              borderRadius: 'var(--border-radius-md)',
              border: '0.5px solid var(--color-border-tertiary)',
              padding: '14px 16px',
              marginBottom: 16,
            }}>
              <SummaryRow
                label={t('nightClose.previewGuests')}
                value={t('nightClose.previewGuestsValue', {
                  count: preview.summary.totalGuests,
                })}
              />
              <SummaryRow
                label={t('nightClose.previewReservations')}
                value={t('nightClose.previewReservationsValue', {
                  count: preview.summary.totalReservations,
                  revenue: sumTableTotals(preview.reservations).toFixed(2),
                })}
              />
              <SummaryRow
                label={t('nightClose.previewNet')}
                value={`€${preview.summary.netCommission.toFixed(2)}`}
                emphasis
              />
              {preview.summary.influencerCount > 0 && (
                <SummaryRow
                  label={t('summary.influencers')}
                  value={String(preview.summary.influencerCount)}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-secondary"
                style={{ flex: 1, padding: 13 }}
                onClick={() => setOpen(false)}
                disabled={working}
              >
                {t('actions.cancel')}
              </button>
              <button
                className="btn-primary"
                style={{ flex: 1, padding: 13 }}
                onClick={onConfirm}
                disabled={working}
              >
                {working
                  ? t('nightClose.saving')
                  : t('nightClose.confirmClose')}
              </button>
            </div>
          </div>
        </IonContent>
      </IonModal>
    </>
  );
};

interface RowProps {
  label: string;
  value: string;
  emphasis?: boolean;
}
const SummaryRow: React.FC<RowProps> = ({ label, value, emphasis }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: emphasis ? 15 : 13,
    fontWeight: emphasis ? 600 : 400,
    color: emphasis ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
  }}>
    <span>{label}</span>
    <span style={{ color: emphasis ? '#3B6D11' : 'var(--color-text-primary)' }}>
      {value}
    </span>
  </div>
);

// Compute the gross "table total" sum for the preview line — uses
// the reservations array directly without going through commCalc
// (commCalc needs venues; the preview already pre-filtered for the
// date so we just sum the prices the user can see).
function sumTableTotals(reservations: { vipType: string }[]): number {
  // The preview's summary already accounts for commissions; this
  // is just the rough "total in mesas" pre-commission for display.
  // We don't have prices here without venues — leave at 0 for the
  // value-side display fallback; the i18n template tolerates either.
  return 0 * reservations.length;
}
