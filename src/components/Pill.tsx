import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { slotById } from '@/features/summary/calculations';

type PillTone = 'amber' | 'pink' | 'teal' | 'gray' | 'green' | 'blue' | 'purple';

interface PillProps {
  tone: PillTone;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Pill: React.FC<PillProps> = ({ tone, children, style }) => (
  <span className={`pill pill-${tone}`} style={style}>{children}</span>
);

// Recreates the original `slotPill(id)` helper — color depends on slot name
export const SlotPill: React.FC<{ slotId: string }> = ({ slotId }) => {
  const events = useAppStore((s) => s.events);
  const s = slotById(slotId, events);
  if (!s) return null;
  const n = s.name.toLowerCase();
  const tone: PillTone = n.includes('lunch')
    ? 'green'
    : n.includes('tard')
    ? 'amber'
    : n.includes('dinner')
    ? 'teal'
    : 'purple';
  return <Pill tone={tone}>{s.name}</Pill>;
};
