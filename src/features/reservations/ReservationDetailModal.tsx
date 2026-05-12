import React from 'react';
import { IonModal, IonContent, IonIcon } from '@ionic/react';
import { logoWhatsapp } from 'ionicons/icons';
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
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]}>
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
          <button className="btn-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="detail-kv"><span className="dk">Venue</span><span className="dv">{venueName(r.venueId, venues)}</span></div>
          <div className="detail-kv"><span className="dk">VIP type</span><span className="dv">{r.vipType} · €{c.price}/table</span></div>
          <div className="detail-kv">
            <span className="dk">When</span>
            <span className="dv">
              {r.eventDate
                ? new Date(r.eventDate + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric',
                  })
                : '—'}
              {r.time ? ` · ${r.time}` : ''}
            </span>
          </div>
          <div className="detail-kv"><span className="dk">Pax</span><span className="dv">{r.pax}</span></div>
          <div className="detail-kv"><span className="dk">Table total</span><span className="dv">€{c.tableTotal}</span></div>
          <div className="detail-kv">
            <span className="dk">Your commission ({r.commissionPct}%)</span>
            <span className="dv" style={{ color: '#3B6D11' }}>€{c.promoter}</span>
          </div>
          {r.fromInvite && (
            <>
              <div className="detail-kv">
                <span className="dk">Via invitation</span>
                <span className="dv">
                  {r.commissionEarner} <SocialBadge handle={r.inviterHandle} platform={r.inviterPlatform} />
                </span>
              </div>
              <div className="detail-kv">
                <span className="dk">Their cut ({r.womanPct}%)</span>
                <span className="dv" style={{ color: '#F97316' }}>€{c.woman}</span>
              </div>
              <div className="detail-kv">
                <span className="dk">Net to you</span>
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
              Send to {v!.name} on WhatsApp
            </button>
          ) : v ? (
            <div className="info-box" style={{ marginTop: 16 }}>
              Add a phone number to <b>{v.name}</b> to send reservations via WhatsApp.
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              className="btn-secondary"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete reservation for ${r.name}?`,
                  confirmLabel: 'Delete',
                  destructive: true,
                });
                if (ok) { removeReservation(r.id); onClose(); }
              }}
            >Delete</button>
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={() => onEdit(r.id)}>Edit</button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

