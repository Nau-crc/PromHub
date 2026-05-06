import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { venueById } from '@/features/summary/calculations';

interface Props {
  venueId: number | null;
  selected: string[];
  onToggle: (slotId: string) => void;
}

export const SlotChips: React.FC<Props> = ({ venueId, selected, onToggle }) => {
  const venues = useAppStore((s) => s.venues);
  const v = venueId != null ? venueById(venueId, venues) : null;
  const slots = v?.timeslots || [];
  const hint = slots.length
    ? `${v!.name} has ${slots.length} timeslot${slots.length > 1 ? 's' : ''}. Pick one or more.`
    : 'No timeslots — edit this venue first.';

  return (
    <>
      <div className="slot-hint">{hint}</div>
      <div>
        {slots.map((s) => {
          const on = selected.includes(s.id);
          return (
            <div
              key={s.id}
              className={`slot-chip ${on ? 'sel' : ''}`}
              onClick={() => onToggle(s.id)}
            >
              <div className="slot-chip-body">
                <div className="slot-chip-name">{s.name}</div>
                <div className="slot-chip-time">{s.startTime} – {s.endTime}</div>
              </div>
              <div className="slot-chip-check">{on ? '✓' : ''}</div>
            </div>
          );
        })}
      </div>
    </>
  );
};
