import React, { useMemo } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import { useConfirm } from '@/store/useConfirmStore';
// venueGuestCount + CapacityBar dropped — venue no longer holds a
// total capacity (lives on events as sum-of-slot-caps now).
import { EmptyBox } from '@/components/EmptyBox';
import type { Venue } from '@/core/types';

export const VenuesPage: React.FC = () => {
  const { venues, venueTypes, removeVenue } = useAppStore((s) => ({
    venues: s.venues,
    venueTypes: s.settings.venueTypes ?? [],
    removeVenue: s.removeVenue,
  }));
  const open = useUIStore((s) => s.open);
  const confirm = useConfirm();
  const { t } = useTranslation();

  // Group venues by their configured type. Order = the workspace's
  // configured list, then any "orphan" types (set on a venue but
  // since removed from the list), and finally an "Uncategorised"
  // bucket for venues with no type set. Empty groups are dropped.
  const grouped = useMemo(() => {
    const buckets = new Map<string, Venue[]>();
    const NO_TYPE = '__none__';
    for (const v of venues) {
      const key = v.venueType?.trim() ? v.venueType.trim() : NO_TYPE;
      const arr = buckets.get(key) ?? [];
      arr.push(v);
      buckets.set(key, arr);
    }
    const ordered: { key: string; label: string; items: Venue[] }[] = [];
    for (const typ of venueTypes) {
      const items = buckets.get(typ);
      if (items?.length) {
        ordered.push({ key: typ, label: typ, items });
        buckets.delete(typ);
      }
    }
    // Surface orphan custom types (alphabetical) before the
    // uncategorised tail so they still get a clear header.
    const remainingTypes = [...buckets.keys()].filter((k) => k !== NO_TYPE).sort();
    for (const typ of remainingTypes) {
      ordered.push({ key: typ, label: typ, items: buckets.get(typ)! });
    }
    const noneItems = buckets.get(NO_TYPE);
    if (noneItems?.length) {
      ordered.push({ key: NO_TYPE, label: t('venues.sectionNone'), items: noneItems });
    }
    return ordered;
  }, [venues, venueTypes, t]);

  const onDelete = async (id: number, name: string) => {
    const ok = await confirm({
      title: t('venues.deleteConfirm', { name }),
      message: t('venues.deleteMessage'),
      confirmLabel: t('actions.delete'),
      destructive: true,
    });
    if (ok) removeVenue(id);
  };

  const renderRow = (v: Venue) => {
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
          // One `list-card` per type section. The section header
          // sits above each card so the divisions read at a glance.
          // When only the "Uncategorised" bucket exists (no types
          // configured yet) we drop the header to avoid noise.
          grouped.length === 1 && grouped[0].key === '__none__' ? (
            <div className="list-card">
              {grouped[0].items.map(renderRow)}
            </div>
          ) : (
            grouped.map((section) => (
              <div key={section.key} style={{ marginBottom: 16 }}>
                <div style={{
                  padding: '0 16px 6px',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                }}>{section.label}</div>
                <div className="list-card">
                  {section.items.map(renderRow)}
                </div>
              </div>
            ))
          )
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
