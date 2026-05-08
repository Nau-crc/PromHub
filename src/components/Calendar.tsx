import React, { useState, useMemo } from 'react';
import { DAYS_SHORT, MONTHS_FULL } from '@/core/constants';
import { isoDay } from '@/core/utils/date';

// ─────────────────────────────────────────────────────────────
//  Custom calendar grid. Two modes:
//    - single:  one date selection, optional `isDateEnabled` to gray out days
//    - range:   pick start, then end. Range is painted in primary color
//               (start/end darker, middle days lighter) — flight-booking style
//
//  Why custom: <input type="date"> can't restrict to a sparse list of allowed
//  dates (needed for reservations where only event occurrences are valid),
//  and IonDatetime doesn't ship a polished range mode.
// ─────────────────────────────────────────────────────────────

interface BaseProps {
  /** Restrict picker to dates ≥ this (inclusive). yyyy-mm-dd */
  minDate?: string;
  /** Restrict picker to dates ≤ this (inclusive). yyyy-mm-dd */
  maxDate?: string;
  /** Custom enable predicate (e.g. only Saturdays within a season). */
  isDateEnabled?: (iso: string) => boolean;
  /** Initial month to render. Defaults to today. */
  initialMonth?: Date;
}

interface SingleProps extends BaseProps {
  mode: 'single';
  value: string | null;        // ISO yyyy-mm-dd
  onChange: (iso: string | null) => void;
}

interface RangeProps extends BaseProps {
  mode: 'range';
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
}

type Props = SingleProps | RangeProps;

export const Calendar: React.FC<Props> = (props) => {
  const initial = props.initialMonth ?? new Date();
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));

  const year = month.getFullYear();
  const monthIdx = month.getMonth();

  const cells = useMemo(() => {
    const firstWd = new Date(year, monthIdx, 1).getDay();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const out: Array<{ day: number | null; iso?: string }> = [];
    for (let i = 0; i < firstWd; i++) out.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      out.push({ day: d, iso });
    }
    while (out.length % 7 !== 0) out.push({ day: null });
    return out;
  }, [year, monthIdx]);

  const isWithinBounds = (iso: string) => {
    if (props.minDate && iso < props.minDate) return false;
    if (props.maxDate && iso > props.maxDate) return false;
    return true;
  };

  const isEnabled = (iso: string) => {
    if (!isWithinBounds(iso)) return false;
    if (props.isDateEnabled && !props.isDateEnabled(iso)) return false;
    return true;
  };

  const onDayClick = (iso: string) => {
    if (!isEnabled(iso)) return;
    if (props.mode === 'single') {
      props.onChange(props.value === iso ? null : iso);
      return;
    }
    // Range mode — flight-booking flow:
    //   - no start yet → set start
    //   - start set, no end → if iso < start, restart range with iso as start
    //                         else set end
    //   - both set → restart with iso as new start, end null
    if (!props.start || (props.start && props.end)) {
      props.onChange(iso, null);
    } else {
      if (iso < props.start) props.onChange(iso, null);
      else props.onChange(props.start, iso);
    }
  };

  const todayIso = isoDay(new Date());

  // For range mode, classify every cell into a state
  const cellState = (iso: string) => {
    if (props.mode === 'single') return props.value === iso ? 'sel' : '';
    if (!props.start) return '';
    if (props.start === iso && !props.end) return 'sel';
    if (props.end) {
      if (iso === props.start && iso === props.end) return 'sel';
      if (iso === props.start) return 'sel-start';
      if (iso === props.end) return 'sel-end';
      if (iso > props.start && iso < props.end) return 'in-range';
    }
    return '';
  };

  const navMonth = (dir: -1 | 1) => setMonth(new Date(year, monthIdx + dir, 1));

  return (
    <div className="cal-wrap">
      <div className="cal-nav">
        <button type="button" className="cal-nav-btn" onClick={() => navMonth(-1)}>‹</button>
        <div className="cal-month-label">{MONTHS_FULL[monthIdx]} {year}</div>
        <button type="button" className="cal-nav-btn" onClick={() => navMonth(1)}>›</button>
      </div>
      <div className="cal-header">
        {DAYS_SHORT.map((d) => <div key={d} className="cal-hd">{d}</div>)}
      </div>
      <div className="cal-grid cal-grid--range">
        {cells.map((c, i) => {
          if (!c.day) return <div key={i} />;
          const iso = c.iso!;
          const enabled = isEnabled(iso);
          const state = cellState(iso);
          const isToday = iso === todayIso;
          return (
            <button
              type="button"
              key={i}
              className={`cal-day ${state} ${enabled ? '' : 'disabled'} ${isToday ? 'is-today' : ''}`}
              onClick={() => onDayClick(iso)}
              disabled={!enabled}
            >
              {c.day}
            </button>
          );
        })}
      </div>
      {props.mode === 'range' && (
        <div className="cal-range-summary">
          <div>
            <div className="cal-range-lbl">From</div>
            <div className="cal-range-val">{props.start ? prettyDate(props.start) : '—'}</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', color: 'var(--color-text-secondary)' }}>→</div>
          <div style={{ textAlign: 'right' }}>
            <div className="cal-range-lbl">To</div>
            <div className="cal-range-val">{props.end ? prettyDate(props.end) : '—'}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const prettyDate = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
