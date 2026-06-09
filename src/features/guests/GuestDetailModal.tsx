import React from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { profileUrl } from '@/core/utils/format';
import { venueName } from '@/features/summary/calculations';
import { StarBadge } from '@/components/SocialBadge';
import { Avatar } from '@/components/Avatar';
import { SheetHeader } from '@/components/SheetHeader';
import { sendViaSocial } from '@/services/messaging';

interface Props {
  open: boolean;
  onClose: () => void;
  guestId: number | null;
  onEdit: (id: number) => void;
}

export const GuestDetailModal: React.FC<Props> = ({ open, onClose, guestId, onEdit }) => {
  const { t } = useTranslation();
  const { guests, venues, events } = useAppStore((s) => ({
    guests: s.guests, venues: s.venues, events: s.events,
  }));
  const g = guestId != null ? guests.find((x) => x.id === guestId) : null;
  if (!g) return <IonModal isOpen={open} onDidDismiss={onClose}><IonContent /></IonModal>;

  const url = profileUrl(g.igHandle, g.igPlatform);
  const visitCount = guests.filter((x) => x.name === g.name && x.influencer).length;
  const clubEv = g.clubEventId ? events.find((x) => x.id === g.clubEventId) : null;
  const linkedEvent = g.eventId ? events.find((x) => x.id === g.eventId) : null;
  const canSendDescription = !!g.igHandle && !!linkedEvent?.description?.trim();

  const sendDescription = async () => {
    if (!canSendDescription || !linkedEvent) return;
    await sendViaSocial(g.igPlatform, g.igHandle, linkedEvent.description.trim());
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
            <Avatar name={g.name} handle={g.igHandle} platform={g.igPlatform} size={42} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                <StarBadge on={g.influencer} /> {g.name}
              </div>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#F97316', textDecoration: 'none' }}>
                  @{g.igHandle}
                </a>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{t('common.noProfile')}</span>
              )}
            </div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label={t('components.closeAria')}>✕</button>
        </div>
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="detail-kv"><span className="dk">{t('guestDetail.venue')}</span><span className="dv">{venueName(g.venueId, venues)}</span></div>
          <div className="detail-kv"><span className="dk">{t('guestDetail.comingTo')}</span><span className="dv">{(g.timeslotNames || []).join(' · ') || '—'}</span></div>
          <div className="detail-kv"><span className="dk">{t('guestDetail.pax')}</span><span className="dv">{g.pax}</span></div>
          <div className="detail-kv">
            <span className="dk">{t('guestDetail.status')}</span>
            <span className="dv" style={{ color: g.checked ? '#0F6E56' : 'var(--color-text-secondary)' }}>
              {g.checked ? t('guests.arrived') : t('guests.pending')}
            </span>
          </div>
          <div className="detail-kv">
            <span className="dk">{t('guestDetail.event')}</span>
            <span className="dv">{g.eventId ? (events.find((x) => x.id === g.eventId)?.name ?? '?') : t('common.none')}</span>
          </div>
          <div className="detail-kv"><span className="dk">{t('guestDetail.clubLater')}</span><span className="dv">{clubEv ? `🌙 ${clubEv.name}` : t('common.no')}</span></div>
          <div className="detail-kv"><span className="dk">{t('guestDetail.influencer')}</span><span className="dv">{g.influencer ? t('common.yes') : t('common.no')}</span></div>
          {g.influencer && (
            <div className="detail-kv">
              <span className="dk">{t('guestDetail.timesVisited')}</span>
              <span className="dv" style={{ color: '#F97316', fontWeight: 600 }}>{visitCount}×</span>
            </div>
          )}
          {canSendDescription && (
            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: 16, padding: 12 }}
              onClick={sendDescription}
            >
              ✈️ {g.igPlatform === 'tiktok' ? 'TikTok' : 'Instagram'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={() => onEdit(g.id)}>
              {t('actions.edit')}
            </button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};
