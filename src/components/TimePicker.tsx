import React, { useEffect, useRef } from 'react';
import { IonModal, IonContent } from '@ionic/react';

// ─────────────────────────────────────────────────────────────
//  Wheel-style time picker (Trainline / iOS-like).
//
//  Two infinite-scroll columns (hours, minutes). The user scrolls
//  each column to align the value to the centered highlight band.
//  We use scroll snapping + a center-detection scrollend handler,
//  which is much lighter than a full virtual-list library.
//
//  Minute column shows 5-minute steps (00, 05, 10, …). Pass
//  `minuteStep` to change.
// ─────────────────────────────────────────────────────────────

interface Props {
  /** "HH:MM" 24h. */
  value: string;
  onChange: (next: string) => void;
  open: boolean;
  onClose: () => void;
  title?: string;
  minuteStep?: number;
}

const ROW_HEIGHT = 36; // px per row, kept in sync with CSS

export const TimePicker: React.FC<Props> = ({
  value, onChange, open, onClose, title = 'Pick time', minuteStep = 5,
}) => {
  const [h0, m0] = parseTime(value);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);

  const hourCol = useRef<HTMLDivElement | null>(null);
  const minCol = useRef<HTMLDivElement | null>(null);
  // Pending picks while the user scrolls; commit on Done.
  const pickedHour = useRef<number>(h0);
  const pickedMin = useRef<number>(snapToStep(m0, minuteStep));

  // When the modal opens, scroll each column to the current value.
  useEffect(() => {
    if (!open) return;
    pickedHour.current = h0;
    pickedMin.current = snapToStep(m0, minuteStep);
    // Defer until the modal animation has finished mounting the panel.
    const t = setTimeout(() => {
      if (hourCol.current) hourCol.current.scrollTop = h0 * ROW_HEIGHT;
      if (minCol.current) minCol.current.scrollTop = (pickedMin.current / minuteStep) * ROW_HEIGHT;
    }, 80);
    return () => clearTimeout(t);
  }, [open, h0, m0, minuteStep]);

  const onScroll = (which: 'h' | 'm', el: HTMLDivElement) => {
    const idx = Math.round(el.scrollTop / ROW_HEIGHT);
    if (which === 'h') pickedHour.current = clamp(idx, 0, 23);
    else pickedMin.current = clamp(minutes[clamp(idx, 0, minutes.length - 1)] ?? 0, 0, 59);
  };

  const commit = () => {
    const hh = String(pickedHour.current).padStart(2, '0');
    const mm = String(pickedMin.current).padStart(2, '0');
    onChange(`${hh}:${mm}`);
    onClose();
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={0.5} breakpoints={[0, 0.5]}>
      <IonContent>
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--color-background-primary)',
        }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</div>
          <button className="btn-ghost" onClick={commit} style={{ fontWeight: 600 }}>Done</button>
        </div>

        <div className="time-wheel-wrap">
          <div className="time-wheel-band" />
          <div
            className="time-wheel-col"
            ref={hourCol}
            onScroll={(e) => onScroll('h', e.currentTarget)}
          >
            <div className="time-wheel-pad" />
            {hours.map((h) => (
              <div key={h} className="time-wheel-row">{String(h).padStart(2, '0')}</div>
            ))}
            <div className="time-wheel-pad" />
          </div>
          <div className="time-wheel-sep">:</div>
          <div
            className="time-wheel-col"
            ref={minCol}
            onScroll={(e) => onScroll('m', e.currentTarget)}
          >
            <div className="time-wheel-pad" />
            {minutes.map((m) => (
              <div key={m} className="time-wheel-row">{String(m).padStart(2, '0')}</div>
            ))}
            <div className="time-wheel-pad" />
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

// ── helpers ────────────────────────────────────────────────
function parseTime(v: string): [number, number] {
  const m = v?.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return [20, 0];
  return [clamp(parseInt(m[1], 10), 0, 23), clamp(parseInt(m[2], 10), 0, 59)];
}
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function snapToStep(n: number, step: number) { return Math.round(n / step) * step; }
