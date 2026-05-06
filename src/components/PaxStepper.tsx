import React from 'react';

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
}

export const PaxStepper: React.FC<Props> = ({ value, onChange, min = 0 }) => (
  <div className="pax-stepper">
    <button type="button" className="pax-btn" onClick={() => onChange(Math.max(min, (value || 0) - 1))}>−</button>
    <div className="pax-val">{value || 0}</div>
    <button type="button" className="pax-btn" onClick={() => onChange((value || 0) + 1)}>+</button>
  </div>
);
