import React, { useEffect, useRef } from 'react';
import { IonModal, IonContent } from '@ionic/react';

// ─────────────────────────────────────────────────────────────
//  Wheel-style time picker (Trainline / iOS-like) with TRUE
//  infinite scroll. Hours wrap 23 → 00 → 01 …; minutes wrap
//  59 → 00 → 05 … in both directions.
//
//  Implementation: render the items list LOOPS times in a tall
//  scroll container. While the user scrolls we silently
//  re-center the scroll position when they enter the first or
//  last copy, so the perceived list is endless.
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

const ROW_HEIGHT = 36;
const LOOPS = 7;          // odd so we can sit on the middle copy
const CENTER_LOOP = 3;    // (LOOPS - 1) / 2

export const TimePicker: React.FC<Props> = ({
  value, onChange, open, onClose, title = 'Pick time', minuteStep = 5,
}) => {
  const [h0, m0] = parseTime(value);
  const minuteValues = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);

  const hourCol = useRef<HTMLDivElement | null>(null);
  const minCol = useRef<HTMLDivElement | null>(null);
  const pickedHour = useRef<number>(h0);
  const pickedMin = useRef<number>(snapToStep(m0, minuteStep));

  useEffect(() => {
    if (!open) return;
    pickedHour.current = h0;
    pickedMin.current = snapToStep(m0, minuteStep);
    // Defer until the modal panel has mounted so scrollTop sticks.
    const t = setTimeout(() => {
      if (hourCol.current) hourCol.current.scrollTop = (CENTER_LOOP * 24 + h0) * ROW_HEIGHT;
      if (minCol.current) {
        const minIdx = pickedMin.current / minuteStep;
        minCol.current.scrollTop = (CENTER_LOOP * minuteValues.length + minIdx) * ROW_HEIGHT;
      }
    }, 80);
    return () => clearTimeout(t);
  }, [open, h0, m0, minuteStep, minuteValues.length]);

  const onScroll = (which: 'h' | 'm', el: HTMLDivElement) => {
    const total = which === 'h' ? 24 : minuteValues.length;
    const fullSize = LOOPS * total * ROW_HEIGHT;
    const oneLoop = total * ROW_HEIGHT;
    // When the user enters the first or last copy, jump to the same
    // visual position in the middle copy. Imperceptible because we
    // teleport by exactly N rows so the centered item is identical.
    if (el.scrollTop < oneLoop) {
      el.scrollTop += oneLoop * (CENTER_LOOP);
    } else if (el.scrollTop > fullSize - oneLoop * 2) {
      el.scrollTop -= oneLoop * (CENTER_LOOP);
    }
    const idx = Math.round(el.scrollTop / ROW_HEIGHT) % total;
    if (which === 'h') {
      pickedHour.current = clamp(idx, 0, 23);
    } else {
      const safeIdx = clamp(idx, 0, minuteValues.length - 1);
      pickedMin.current = minuteValues[safeIdx] ?? 0;
    }
  };

  const commit = () => {
    const hh = String(pickedHour.current).padStart(2, '0');
    const mm = String(pickedMin.current).padStart(2, '0');
    onChange(`${hh}:${mm}`);
    onClose();
  };

  // Helpers to generate the looped lists
  const repeated = <T,>(arr: T[]): T[] => {
    const out: T[] = [];
    for (let i = 0; i < LOOPS; i++) out.push(...arr);
    return out;
  };
  const hourList = repeated(Array.from({ length: 24 }, (_, i) => i));
  const minList = repeated(minuteValues);

  return (
    <IonModal isOpen={open} onDidDismiss={onClose} initialBreakpoint={0.5} breakpoints={[0, 0.5]}>
      <IonContent>
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--color-background-primary)',
        }}>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 14 }}>Cancel</button>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</div>
          <button className="btn-ghost" onClick={commit} style={{ fontWeight: 600, fontSize: 14 }}>Done</button>
        </div>

        <div className="time-wheel-wrap">
          <div className="time-wheel-band" />
          <div
            className="time-wheel-col"
            ref={hourCol}
            onScroll={(e) => onScroll('h', e.currentTarget)}
          >
            <div className="time-wheel-pad" />
            {hourList.map((h, i) => (
              <div key={`h-${i}`} className="time-wheel-row">{String(h).padStart(2, '0')}</div>
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
            {minList.map((m, i) => (
              <div key={`m-${i}`} className="time-wheel-row">{String(m).padStart(2, '0')}</div>
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
