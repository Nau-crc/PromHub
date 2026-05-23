import React, { useEffect, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import type { Venue, Timeslot, VipType } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { TimeslotRows, VipRows } from './VenueEditor';
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
  const { upsertVenue, removeVenue } = useAppStore((s) => ({
    upsertVenue: s.upsertVenue, removeVenue: s.removeVenue,
  }));
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [guestCap, setGuestCap] = useState<number | ''>('');
  const [phoneCode, setPhoneCode] = useState<string>('+34');
  const [phoneNum, setPhoneNum] = useState<string>('');
  const [tsRows, setTsRows] = useState<Timeslot[]>([]);
  const [vipRows, setVipRows] = useState<VipType[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setGuestCap(editing?.guestCapacity ? editing.guestCapacity : '');
    setPhoneCode(editing?.phoneCode || '+34');
    setPhoneNum(editing?.phoneNum || '');
    setTsRows(editing ? [...(editing.timeslots || [])] : []);
    setVipRows(editing ? [...(editing.vipTypes || [])] : []);
  }, [open, editing]);

  const phoneDigits = onlyDigits(phoneNum);
  // Empty phone is OK (it's optional). If there's any digit, it must match
  // the country format — same rule as the reservation phone.
  const phoneOk = !phoneDigits || isValidPhone(phoneCode, phoneDigits);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { alert('Venue name is required.'); return; }
    if (!tsRows.filter((r) => r.name.trim()).length) {
      alert('Add at least one timeslot.');
      return;
    }
    if (phoneDigits && !phoneOk) {
      alert(`Phone number doesn't match the format for ${phoneCode}.`);
      return;
    }
    const newTs = tsRows.filter((r) => r.name.trim()).map((r) => ({
      ...r, name: r.name.trim(), guestCapacity: r.guestCapacity || 0,
    }));
    const newVip = vipRows.filter((r) => r.name.trim()).map((r) => ({
      ...r,
      name: r.name.trim(),
      minPax: r.minPax || 1,
      maxPax: r.maxPax || 10,
      tableCapacity: r.tableCapacity || 0,
    }));
    // Top-level entity IDs come from the backend (Postgres SERIAL).
    // We pass the editing.id only when updating; new venues omit it
    // and upsertVenue handles the create-vs-update branch.
    const entry = {
      ...(editing?.id != null ? { id: editing.id } : {}),
      name: trimmed,
      guestCapacity: typeof guestCap === 'number' ? guestCap : (parseInt(String(guestCap)) || 0),
      timeslots: newTs,
      vipTypes: newVip,
      phoneCode: phoneDigits ? phoneCode : '',
      phoneNum: phoneDigits ? phoneNum.trim() : '',
    } as Venue | Omit<Venue, 'id'>;
    try {
      await upsertVenue(entry);
      onClose();
    } catch (err) {
      alert(`Couldn't save venue: ${(err as Error).message}`);
    }
  };

  const confirmDelete = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: `Delete ${editing.name}?`,
      message: 'Future events at this venue and their guests will be removed. Past events stay for reporting.',
      confirmLabel: 'Delete',
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
        <SheetHeader title={editing ? 'Edit venue' : 'Add venue'} onClose={onClose} />
        <div style={{ padding: '16px 16px 32px' }}>
          <div className="form-group">
            <label className="form-label">Venue name</label>
            <input className="form-input" placeholder="e.g. Carpe Diem" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Guest capacity (total)</label>
            <input
              className="form-input" type="number" min={0} placeholder="e.g. 200"
              value={guestCap}
              onChange={(e) => setGuestCap(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Used to send reservation details to the venue on WhatsApp.
            </div>
            <div className="phone-row">
              <SelectField
                value={phoneCode}
                onChange={(code) => {
                  setPhoneCode(code);
                  const limited = onlyDigits(phoneNum).slice(0, maxDigits(code));
                  setPhoneNum(formatPhone(code, limited));
                }}
                title="Country code"
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
                ⚠︎ Format for {phoneCode} doesn't match. Expected like: {placeholderForCode(phoneCode)}
              </div>
            )}
          </div>

          <TimeslotRows rows={tsRows} setRows={setTsRows} />
          <VipRows rows={vipRows} setRows={setVipRows} />

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {editing && (
              <button className="btn-danger" onClick={confirmDelete}>Delete</button>
            )}
            <button className="btn-primary" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={save}>
              Save
            </button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};
