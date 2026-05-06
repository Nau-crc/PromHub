import React from 'react';

interface Props {
  pct: number;
  warnAt?: number;  // % at which it turns amber
  fullAt?: number;  // % at which it turns red
}

export const CapacityBar: React.FC<Props> = ({ pct, warnAt = 75, fullAt = 100 }) => {
  const cls = pct >= fullAt ? 'full' : pct >= warnAt ? 'warn' : '';
  return (
    <div className="capacity-bar">
      <div className={`capacity-fill ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
};
