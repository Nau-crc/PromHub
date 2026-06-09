import React from 'react';
import { IonModal, IonContent, IonIcon } from '@ionic/react';
import { logoWhatsapp } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { initials } from '@/core/utils/format';
import { commCalc, venueById, venueName, netToYou } from '@/features/summary/calculations';
import { SocialBadge } from '@/components/SocialBadge';
import { sendViaWhatsApp } from '@/services/messaging';

interface Props {
  open: boolean;
  onClose: () => void;
  reservationId: number | null;
  onEdit: (id: number) => void;
}

export const ReservationDetailModal: React.FC<Props> = ({ open, onClose, reservationId, onEdit }) => {
  const { t } = useTranslation();
  const { reservations, venues, removeReservation } = useAppStore((s) => ({
    reservations: s.reservations, venues: s.venues, removeReservation: s.removeReservation,
  }));
  const confirm = useConfirm();
  const r = reservationId != null ? reservations.find((x) => x.id === reservationId) : null;
  if (!r) return <IonModal isOpen={open} onDidDismiss={onClose}><IonContent /></IonModal>;
  const c = commCalc(r, venues);
  const v = venueById(r.venueId, venues);
  const venueHasPhone = !!(v?.phoneCode && v?.phoneNum);

  // Build the WhatsApp message the promoter sends to the venue.
  // Uses plain text labels (no emoji) so it renders identically on
  // every WhatsApp client regardless of emoji-font support. WhatsApp
  // formats *…* as bold and `—` is preserved as-is.
  const buildWhatsAppMessage = (): string => {
    const dateLabel = r.eventDate
      ? new Date(r.eventDate + 'T00:00:00').toLocaleDateString(undefined, {
          weekday: 'long', day: 'numeric', month: 'long',
        })
      : '—';
    const lines = [
      `*New reservation — ${v?.name ?? 'the venue'}*`,
      '',
      `Name:  ${r.name}`,
      r.phoneNum ? `Phone: ${r.phoneCode} ${r.phoneNum}` : '',
      `When:  ${dateLabel}${r.time ? ` · ${r.time}` : ''}`,
      `Table: ${r.vipType || '—'}${c.price ? ` · €${c.price}` : ''}`,
      `Pax:   ${r.pax}`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const onWhatsApp = () => {
    if (!v) return;
    sendViaWhatsApp(
      { phoneCode: v.phoneCode ?? '', phoneNum: v.phoneNum ?? '' },
      buildWhatsAppMessage(),
    );
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <IonContent>
        <div style={{
          padding: '14px 16px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--color-background-primary)', zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="list-avatar" style={{ background: '#EAF3DE', color: '#3B6D11', width: 42, height: 42, fontSize: 15 }}>
              {initials(r.name)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {r.phoneCode || ''} {r.phoneNum || 'No phone'}
              </div>
            </div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label={t('components.closeAria')}>✕</button>
        </div>
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="detail-kv"><span className="dk">{t('reservationDetail.venue')}</span><span className="dv">{venueName(r.venueId, venues)}</span></div>
          <div className="detail-kv"><span className="dk">VIP</span><span className="dv">{r.vipType} · €{c.price}/{t('reservationDetail.tableTotal').toLowerCase()}</span></div>
          <div className="detail-kv">
            <span className="dk">{t('reservationDetail.when')}</span>
            <span className="dv">
              {r.eventDate
                ? new Date(r.eventDate + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric',
                  })
                : '—'}
              {r.time ? ` · ${r.time}` : ''}
            </span>
          </div>
          <div className="detail-kv"><span className="dk">{t('reservationDetail.pax')}</span><span className="dv">{r.pax}</span></div>
          <div className="detail-kv"><span className="dk">{t('reservationDetail.tableTotal')}</span><span className="dv">€{c.tableTotal}</span></div>
          <div className="detail-kv">
            <span className="dk">{t('reservationForm.yourCommission')} ({r.commissionPct}%)</span>
            <span className="dv" style={{ color: '#3B6D11' }}>€{c.promoter}</span>
          </div>
          {r.fromInvite && (
            <>
              <div className="detail-kv">
                <span className="dk">{t('reservationDetail.viaInvitation')}</span>
                <span className="dv">
                  {r.commissionEarner} <SocialBadge handle={r.inviterHandle} platform={r.inviterPlatform} />
                </span>
              </div>
              <div className="detail-kv">
                <span className="dk">{t('reservationForm.inviterPct')} ({r.womanPct}%)</span>
                <span className="dv" style={{ color: '#F97316' }}>€{c.woman}</span>
              </div>
              <div className="detail-kv">
                <span className="dk">{t('reservationDetail.netToYou')}</span>
                <span className="dv" style={{ color: '#3B6D11' }}>€{netToYou(c)}</span>
              </div>
            </>
          )}
          {venueHasPhone ? (
            <button
              type="button"
              onClick={onWhatsApp}
              style={{
                width: '100%', marginTop: 16, padding: 12,
                background: '#25D366', color: '#fff',
                border: 'none', borderRadius: 'var(--border-radius-md)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <IonIcon icon={logoWhatsapp} style={{ fontSize: 18 }} />
              {t('actions.sendOnWhatsApp')}
            </button>
          ) : null}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              className="btn-secondary"
              onClick={async () => {
                const ok = await confirm({
                  title: t('reservationDetail.deleteTitle', { name: r.name }),
                  confirmLabel: t('actions.delete'),
                  destructive: true,
                });
                if (ok) { removeReservation(r.id); onClose(); }
              }}
            >{t('actions.delete')}</button>
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={() => onEdit(r.id)}>{t('actions.edit')}</button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

