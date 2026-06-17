import React, { useEffect, useState } from 'react';
import { IonModal, IonContent, IonIcon } from '@ionic/react';
import { sunnyOutline, moonOutline, contrastOutline, addOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useThemeStore, type ThemeChoice } from '@/store/useThemeStore';
import { useLocaleStore, type LocaleChoice } from '@/store/useLocaleStore';
import { SheetHeader } from '@/components/SheetHeader';

// ─────────────────────────────────────────────────────────────
//  SettingsModal — opened from the gear icon at the bottom of
//  the drawer. Holds three sections:
//    1. Appearance (theme toggle)
//    2. Language
//    3. Venue types (configurable list — drives the sections in
//       VenuesPage and the type picker in VenueFormModal)
//
//  Theme / language live in their own stores (local persistence).
//  Venue types live in the workspace settings on the server. Both
//  paths converge in this single panel so the promoter doesn't
//  have to hunt for any preference.
// ─────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { themeChoice, setTheme } = useThemeStore((s) => ({
    themeChoice: s.choice, setTheme: s.set,
  }));
  const { localeChoice, setLocale } = useLocaleStore((s) => ({
    localeChoice: s.choice, setLocale: s.set,
  }));
  const { settings, updateSettings } = useAppStore((s) => ({
    settings: s.settings, updateSettings: s.updateSettings,
  }));

  // Local draft of the venue-types list — saved on blur/Enter via
  // `commit()`. Keeps the input editable without firing a PATCH per
  // keystroke.
  const [venueTypesDraft, setVenueTypesDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVenueTypesDraft([...(settings.venueTypes ?? [])]);
  }, [open, settings.venueTypes]);

  const themeOpts: { value: ThemeChoice; icon: string; labelKey: string }[] = [
    { value: 'light', icon: sunnyOutline, labelKey: 'drawer.light' },
    { value: 'dark', icon: moonOutline, labelKey: 'drawer.dark' },
    { value: 'system', icon: contrastOutline, labelKey: 'drawer.auto' },
  ];

  const localeOpts: { value: LocaleChoice; label: string }[] = [
    { value: 'auto', label: t('drawer.auto') },
    { value: 'en', label: 'EN' },
    { value: 'es', label: 'ES' },
    { value: 'ca', label: 'CA' },
  ];

  const addType = () =>
    setVenueTypesDraft((arr) => [...arr, '']);
  const updateType = (idx: number, value: string) =>
    setVenueTypesDraft((arr) => arr.map((v, i) => i === idx ? value : v));
  const removeType = (idx: number) =>
    setVenueTypesDraft((arr) => arr.filter((_, i) => i !== idx));

  const commit = async () => {
    const cleaned = venueTypesDraft
      .map((v) => v.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await updateSettings({ venueTypes: cleaned });
    } catch (err) {
      alert(t('settings.saveFailed', { message: (err as Error).message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <IonContent>
        <SheetHeader title={t('settings.title')} onClose={onClose} />
        <div style={{ padding: '16px 16px 32px' }}>

          {/* ── Appearance ─────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">{t('drawer.appearance')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {themeOpts.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`tog-btn ${themeChoice === o.value ? 'on' : ''}`}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => setTheme(o.value)}
                >
                  <IonIcon icon={o.icon} style={{ fontSize: 14 }} />
                  {t(o.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Language ───────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">{t('drawer.language')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {localeOpts.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`tog-btn ${localeChoice === o.value ? 'on' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setLocale(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Venue types ────────────────────────────────── */}
          <div className="form-group">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              <label className="form-label" style={{ margin: 0 }}>
                {t('settings.venueTypes')}
              </label>
              <button type="button" className="btn-sm" onClick={addType}>
                <IonIcon icon={addOutline} style={{ fontSize: 13, verticalAlign: 'middle' }} />
                {' '}{t('actions.add')}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
              {t('settings.venueTypesHint')}
            </div>
            {venueTypesDraft.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '4px 0' }}>
                {t('settings.noVenueTypes')}
              </div>
            ) : venueTypesDraft.map((value, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6,
              }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  value={value}
                  onChange={(e) => updateType(idx, e.target.value)}
                  placeholder={t('settings.venueTypePlaceholder')}
                />
                <button
                  type="button"
                  className="row-del-btn"
                  aria-label={t('actions.delete')}
                  onClick={() => removeType(idx)}
                >✕</button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: 13, fontSize: 14, marginTop: 12 }}
            onClick={commit}
            disabled={saving}
          >
            {saving ? t('actions.save') + '…' : t('actions.save')}
          </button>
        </div>
      </IonContent>
    </IonModal>
  );
};
