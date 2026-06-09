import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PromEvent } from '@/core/types';
import { nextOccurrence, occurs, previousOccurrence } from '@/features/summary/calculations';
import { isoDay } from '@/core/utils/date';

// ─────────────────────────────────────────────────────────────
//  Stepper-style date picker for an event with sparse occurrences.
//  Two arrows hop forward/back to the next valid occurrence; the
//  middle shows the currently picked date (or "Pick a date").
//
//  Used in guest/reservation forms instead of a full calendar grid
//  with most days disabled — cleaner for recurring events.
// ─────────────────────────────────────────────────────────────

interface Props {
  event: PromEvent;
  value: string;                       // ISO yyyy-mm-dd or ''
  onChange: (iso: string) => void;
}

export const OccurrencePicker: React.FC<Props> = ({ event, value, onChange }) => {
  const { t } = useTranslation();
  const stepBackward = () => {
    const seed = value || isoDay(new Date());
    // Go to the day before so we don't loop on the same date
    const [y, m, d] = seed.split('-').map(Number);
    const prevSeed = isoDay(new Date(y, m - 1, d - 1));
    const prev = previousOccurrence(event, prevSeed);
    if (prev) {
      // Respect season bounds — previousOccurrence already does this
      onChange(prev);
    }
  };

  const stepForward = () => {
    const seed = value || isoDay(new Date());
    const [y, m, d] = seed.split('-').map(Number);
    const nextSeed = isoDay(new Date(y, m - 1, d + 1));
    const next = nextOccurrence(event, nextSeed);
    if (next) onChange(next);
  };

  // Disable arrows when the season blocks further movement
  const seedNext = (() => {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    return isoDay(new Date(y, m - 1, d + 1));
  })();
  const seedPrev = (() => {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    return isoDay(new Date(y, m - 1, d - 1));
  })();
  const canBack = !!value && !!previousOccurrence(event, seedPrev);
  const canForward = !!value && !!nextOccurrence(event, seedNext);

  // If no current value, suggest the first valid one
  const placeholder = nextOccurrence(event, isoDay(new Date()));
  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : placeholder
      ? `→ ${new Date(placeholder + 'T00:00:00').toLocaleDateString(undefined, {
          month: 'short', day: 'numeric',
        })}`
      : t('common.dash');

  return (
    <div className="occ-picker">
      <button
        type="button"
        className="cal-nav-btn"
        onClick={stepBackward}
        disabled={!canBack}
        aria-label={t('components.prevOccurrence')}
      >‹</button>
      <div className="occ-picker-display">
        <div className="occ-picker-label">{t('components.eventDate')}</div>
        <div className="occ-picker-value">{display}</div>
      </div>
      <button
        type="button"
        className="cal-nav-btn"
        onClick={() => {
          if (!value && placeholder) onChange(placeholder);
          else stepForward();
        }}
        disabled={!value && !placeholder}
        aria-label={t('components.nextOccurrence')}
      >›</button>
    </div>
  );
};
