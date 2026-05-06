import React from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { venueGuestCount } from '@/features/summary/calculations';
import { CapacityBar } from '@/components/CapacityBar';
import { EmptyBox } from '@/components/EmptyBox';

export const VenuesPage: React.FC = () => {
  const { venues, guests, removeVenue } = useAppStore((s) => ({
    venues: s.venues, guests: s.guests, removeVenue: s.removeVenue,
  }));
  const open = useUIStore((s) => s.open);

  const onDelete = (id: number, name: string) => {
    if (window.confirm(`Delete ${name}?`)) removeVenue(id);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="page-title">Venues</div>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => open('addVenue')}
              >+ Add</button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="spacer" />
        {venues.length ? (
          <div className="list-card">
            {venues.map((v) => {
              const gc = venueGuestCount(v.id, guests);
              const gcap = v.guestCapacity || 0;
              const gpct = gcap ? Math.min(100, Math.round((gc / gcap) * 100)) : 0;
              const slots = (v.timeslots || []).map((s) => `${s.name} ${s.startTime}–${s.endTime}`).join(', ') || 'No timeslots';
              const vips = (v.vipTypes || []).map(
                (t) => `${t.name}(${t.minPax}-${t.maxPax}pax €${t.price}/${t.tableCapacity || 0}tbls)`,
              ).join(', ') || 'No VIP types';
              const invTypes = (v.inviteTypes || []).map((t) => t.name).join(', ') || 'No invite types';
              return (
                <div key={v.id} className="venue-row-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="venue-name">{v.name}</div>
                    <div className="venue-sub">
                      {slots}<br />{vips}<br />Invite: {invTypes}
                    </div>
                    {gcap > 0 && (
                      <>
                        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 5 }}>
                          Guests {gc}/{gcap}
                        </div>
                        <CapacityBar pct={gpct} warnAt={80} />
                      </>
                    )}
                  </div>
                  <div className="venue-acts">
                    <button className="tag-btn" onClick={() => open('editVenue', { id: v.id })}>Edit</button>
                    <button className="tag-btn" style={{ color: '#A32D2D' }} onClick={() => onDelete(v.id, v.name)}>Del</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyBox>
            No venues yet.<br />
            Tap <b>+ Add</b> to add your first venue.
          </EmptyBox>
        )}
        <div className="spacer" />
      </IonContent>
    </IonPage>
  );
};
