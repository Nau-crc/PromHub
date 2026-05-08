import React, { useEffect, useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import type { Venue, Timeslot, VipType, InviteType } from '@/core/types';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { TimeslotRows, VipRows, InviteTypeRows } from './VenueEditor';
import { SheetHeader } from '@/components/SheetHeader';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Venue | null;
}

export const VenueFormModal: React.FC<Props> = ({ open, onClose, editing }) => {
  const { upsertVenue, removeVenue, nextId } = useAppStore((s) => ({
    upsertVenue: s.upsertVenue, removeVenue: s.removeVenue, nextId: s.nextId,
  }));
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [guestCap, setGuestCap] = useState<number | ''>('');
  const [tsRows, setTsRows] = useState<Timeslot[]>([]);
  const [vipRows, setVipRows] = useState<VipType[]>([]);
  const [invRows, setInvRows] = useState<InviteType[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setGuestCap(editing?.guestCapacity ? editing.guestCapacity : '');
    setTsRows(editing ? [...(editing.timeslots || [])] : []);
    setVipRows(editing ? [...(editing.vipTypes || [])] : []);
    setInvRows(editing ? [...(editing.inviteTypes || [])] : []);
  }, [open, editing]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) { alert('Venue name is required.'); return; }
    // At least one timeslot is needed for events to schedule against.
    if (!tsRows.filter((r) => r.name.trim()).length) {
      alert('Add at least one timeslot.');
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
    const newInv = invRows.filter((r) => r.name.trim()).map((r) => ({
      ...r, name: r.name.trim(),
    }));
    const entry: Venue = {
      id: editing?.id ?? (nextId('venue') as number),
      name: trimmed,
      guestCapacity: typeof guestCap === 'number' ? guestCap : (parseInt(String(guestCap)) || 0),
      timeslots: newTs,
      vipTypes: newVip,
      inviteTypes: newInv,
    };
    upsertVenue(entry);
    onClose();
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
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]}>
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

          <TimeslotRows rows={tsRows} setRows={setTsRows} />
          <VipRows rows={vipRows} setRows={setVipRows} />
          <InviteTypeRows rows={invRows} setRows={setInvRows} />

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
