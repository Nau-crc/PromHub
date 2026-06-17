import React, { useEffect, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { Venue, VipType } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { VipRows } from './VenueEditor';
import { SheetHeader } from '@/components/SheetHeader';
import { SelectField } from '@/components/SelectField';
import { COUNTRY_CODES } from '@/core/constants';
import {
  formatPhone, isValidPhone, maxDigits, onlyDigits, placeholderForCode,
} from '@/core/utils/phone';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Venue | null;
}

export const VenueFormModal: React.FC<Props> = ({ open, onClose, editing }) => {
  const { t } = useTranslation();
  const { upsertVenue, removeVenue, venueTypes } = useAppStore((s) => ({
    upsertVenue: s.upsertVenue, removeVenue: s.removeVenue,
    venueTypes: s.settings.venueTypes ?? [],
  }));
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [venueType, setVenueType] = useState<string>('');
  const [phoneCode, setPhoneCode] = useState<string>('+34');
  const [phoneNum, setPhoneNum] = useState<string>('');
  const [vipRows, setVipRows] = useState<VipType[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setVenueType(editing?.venueType ?? '');
    setPhoneCode(editing?.phoneCode || '+34');
    setPhoneNum(editing?.phoneNum || '');
    setVipRows(editing ? [...(editing.vipTypes || [])] : []);
  }, [open, editing]);

  const phoneDigits = onlyDigits(phoneNum);
  const phoneOk = !phoneDigits || isValidPhone(phoneCode, phoneDigits);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { alert(t('venueForm.errNameRequired')); return; }
    if (phoneDigits && !phoneOk) {
      alert(t('venueForm.errPhoneFmt', { code: phoneCode }));
      return;
    }
    // VIP types only carry identity + capacity now — pricing is per
    // event. Strip out any legacy `price` from rows before saving.
    const newVip = vipRows.filter((r) => r.name.trim()).map((r) => ({
      id: r.id,
      name: r.name.trim(),
      minPax: r.minPax || 1,
      maxPax: r.maxPax || 10,
      tableCapacity: r.tableCapacity || 0,
    }));
    const entry = {
      ...(editing?.id != null ? { id: editing.id } : {}),
      name: trimmed,
      venueType: venueType.trim() ? venueType.trim() : null,
      vipTypes: newVip,
      phoneCode: phoneDigits ? phoneCode : '',
      phoneNum: phoneDigits ? phoneNum.trim() : '',
    } as Venue | Omit<Venue, 'id'>;
    try {
      await upsertVenue(entry);
      onClose();
    } catch (err) {
      alert(t('venueForm.couldntSave', { message: (err as Error).message }));
    }
  };

  const confirmDelete = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: t('venues.deleteConfirm', { name: editing.name }),
      message: t('venues.deleteMessage'),
      confirmLabel: t('actions.delete'),
      destructive: true,
    });
    if (ok) {
      removeVenue(editing.id);
      onClose();
    }
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <IonContent>
        <SheetHeader title={editing ? t('venueForm.titleEdit') : t('venueForm.titleNew')} onClose={onClose} />
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="form-group">
            <label className="form-label">{t('venueForm.name')}</label>
            <input className="form-input" placeholder={t('venueForm.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('venueForm.venueType')}</label>
            <SelectField
              value={venueType}
              onChange={setVenueType}
              title={t('venueForm.venueType')}
              options={[
                { value: '', label: t('venues.sectionNone') },
                ...venueTypes.map((typ) => ({ value: typ, label: typ })),
                // If editing a venue whose type was removed from the
                // workspace list, surface it here so it stays
                // selectable until the promoter picks a new one.
                ...(venueType && !venueTypes.includes(venueType)
                  ? [{ value: venueType, label: venueType }]
                  : []),
              ]}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('venueForm.phone')}</label>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              {t('venueForm.phoneHint')}
            </div>
            <div className="phone-row">
              <SelectField
                value={phoneCode}
                onChange={(code) => {
                  setPhoneCode(code);
                  const limited = onlyDigits(phoneNum).slice(0, maxDigits(code));
                  setPhoneNum(formatPhone(code, limited));
                }}
                title={t('venueForm.countryCode')}
                style={{ minWidth: 110, flexShrink: 0 }}
                options={COUNTRY_CODES.map((c) => ({
                  value: c.code,
                  label: `${c.flag} ${c.code}`,
                }))}
              />
              <input
                className="form-input"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={placeholderForCode(phoneCode)}
                value={phoneNum}
                onChange={(e) => {
                  const limited = onlyDigits(e.target.value).slice(0, maxDigits(phoneCode));
                  setPhoneNum(formatPhone(phoneCode, limited));
                }}
              />
            </div>
            {phoneDigits.length > 0 && !phoneOk && (
              <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>
                {t('venueForm.phoneFmtError', { code: phoneCode, example: placeholderForCode(phoneCode) })}
              </div>
            )}
          </div>

          <VipRows rows={vipRows} setRows={setVipRows} />

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {editing && (
              <button className="btn-danger" onClick={confirmDelete}>{t('actions.delete')}</button>
            )}
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={save}>
              {t('actions.save')}
            </button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};
