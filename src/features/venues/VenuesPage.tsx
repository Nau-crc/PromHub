import React from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { useConfirm } from '@/store/useConfirmStore';
// venueGuestCount + CapacityBar dropped — venue no longer holds a
// total capacity (lives on events as sum-of-slot-caps now).
import { EmptyBox } from '@/components/EmptyBox';

export const VenuesPage: React.FC = () => {
  const { venues, guests, removeVenue } = useAppStore((s) => ({
    venues: s.venues, guests: s.guests, removeVenue: s.removeVenue,
  }));
  const open = useUIStore((s) => s.open);
  const confirm = useConfirm();
  const { t } = useTranslation();

  const onDelete = async (id: number, name: string) => {
    const ok = await confirm({
      title: t('venues.deleteConfirm', { name }),
      message: t('venues.deleteMessage'),
      confirmLabel: t('actions.delete'),
      destructive: true,
    });
    if (ok) removeVenue(id);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="page-title">{t('venues.title')}</div>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => open('addVenue')}
              >{t('venues.addBtn')}</button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {venues.length ? (
          <div className="list-card">
            {venues.map((v) => {
              // Capacity and timeslot lists moved to the EVENT after
              // 0008 — venues now just declare identity, phone, and
              // VIP types. Display sticks to those.
              const phone = v.phoneCode && v.phoneNum
                ? `${v.phoneCode} ${v.phoneNum}`
                : null;
              const vips = (v.vipTypes || []).map(
                (vp) => `${vp.name} (${vp.minPax}-${vp.maxPax} pax · ${vp.tableCapacity || 0} tbls)`,
              ).join(', ') || t('venues.noVipTypes');
              return (
                <div key={v.id} className="venue-row-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="venue-name">{v.name}</div>
                    <div className="venue-sub">
                      {phone && <>{phone}<br /></>}
                      {vips}
                    </div>
                  </div>
                  <div className="venue-acts">
                    <button className="tag-btn" onClick={() => open('editVenue', { id: v.id })}>{t('actions.edit')}</button>
                    <button className="tag-btn" style={{ color: '#A32D2D' }} onClick={() => onDelete(v.id, v.name)}>{t('actions.deleteShort')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyBox>
            {t('venues.empty')}<br />
            <span dangerouslySetInnerHTML={{ __html: t('venues.emptySub') }} />
          </EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
