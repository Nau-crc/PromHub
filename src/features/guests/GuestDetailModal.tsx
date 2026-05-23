import React from 'react';
import { IonModal, IonContent } from '@ionic/react';
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
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>No profile</span>
              )}
            </div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="detail-kv"><span className="dk">Venue</span><span className="dv">{venueName(g.venueId, venues)}</span></div>
          <div className="detail-kv"><span className="dk">Coming to</span><span className="dv">{(g.timeslotNames || []).join(' · ') || '—'}</span></div>
          <div className="detail-kv"><span className="dk">Pax</span><span className="dv">{g.pax}</span></div>
          <div className="detail-kv">
            <span className="dk">Status</span>
            <span className="dv" style={{ color: g.checked ? '#0F6E56' : 'var(--color-text-secondary)' }}>
              {g.checked ? 'Arrived' : 'Pending'}
            </span>
          </div>
          <div className="detail-kv">
            <span className="dk">Event</span>
            <span className="dv">{g.eventId ? (events.find((x) => x.id === g.eventId)?.name ?? '?') : 'None'}</span>
          </div>
          <div className="detail-kv"><span className="dk">Club later</span><span className="dv">{clubEv ? `🌙 ${clubEv.name}` : 'No'}</span></div>
          <div className="detail-kv"><span className="dk">Influencer</span><span className="dv">{g.influencer ? 'Yes' : 'No'}</span></div>
          {g.influencer && (
            <div className="detail-kv">
              <span className="dk">Times visited</span>
              <span className="dv" style={{ color: '#F97316', fontWeight: 600 }}>{visitCount}×</span>
            </div>
          )}
          {canSendDescription && (
            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: 16, padding: 12 }}
              onClick={sendDescription}
            >
              ✈️ Send event description on {g.igPlatform === 'tiktok' ? 'TikTok' : 'Instagram'}
            </button>
          )}
          <div style={{
            fontSize: 11, color: 'var(--color-text-secondary)',
            marginTop: 12, fontStyle: 'italic',
          }}>
            Tip: swipe right on a guest in the list to mark arrived/pending.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={() => onEdit(g.id)}>
              Edit
            </button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};
