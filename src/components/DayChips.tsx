import React from 'react';
import { WEEKDAYS_ALL } from '@/core/constants';

interface Props {
  selected: string[];
  onToggle: (day: string) => void;
}

export const DayChips: React.FC<Props> = ({ selected, onToggle }) => (
  <div className="chip-picker">
    {WEEKDAYS_ALL.map((d) => (
      <div
        key={d}
        className={`day-chip ${selected.includes(d) ? 'sel' : ''}`}
        onClick={() => onToggle(d)}
      >
        {d.slice(0, 3)}
      </div>
    ))}
  </div>
);
