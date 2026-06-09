import React, { useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { Calendar } from './Calendar';

// ─────────────────────────────────────────────────────────────
//  A clickable date "input" that opens our Calendar component in
//  a sheet modal. Solves two issues with native <input type="date">:
//   - Browsers/WebViews that only open the picker when tapping the
//     calendar icon (not the whole field).
//   - Inconsistent native UI between iOS Safari, Android, desktop.
//
//  Modes mirror Calendar:
//   - 'single': pick one date.
//   - 'range':  pick start, then end (flight-booking style).
// ─────────────────────────────────────────────────────────────

interface BaseProps {
  label?: string;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface SingleProps extends BaseProps {
  mode: 'single';
  value: string | null;
  onChange: (iso: string | null) => void;
}

interface RangeProps extends BaseProps {
  mode: 'range';
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
}

type Props = SingleProps | RangeProps;

const fmt = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

export const DateField: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const display = (() => {
    if (props.mode === 'single') {
      return props.value ? fmt(props.value) : (props.placeholder ?? 'Pick a date');
    }
    if (props.start && props.end) return `${fmt(props.start)} → ${fmt(props.end)}`;
    if (props.start) return `${fmt(props.start)} → ?`;
    return props.placeholder ?? 'Pick a date range';
  })();

  return (
    <>
      <button
        type="button"
        className={props.className ?? 'form-input'}
        style={{
          textAlign: 'left',
          cursor: 'pointer',
          ...props.style,
        }}
        onClick={() => setOpen(true)}
      >
        {display}
      </button>
      <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
        <IonContent>
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            position: 'sticky', top: 0, background: 'var(--color-background-primary)', zIndex: 10,
          }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {props.label ?? t('common.pickADate')}
            </div>
            <button className="btn-ghost" onClick={() => setOpen(false)}>{t('actions.done')}</button>
          </div>
          <div style={{ padding: 16 }}>
            {props.mode === 'single' ? (
              <Calendar
                mode="single"
                value={props.value}
                onChange={(iso) => {
                  props.onChange(iso);
                  if (iso) setOpen(false);
                }}
                minDate={props.minDate}
                maxDate={props.maxDate}
                initialMonth={props.value ? new Date(props.value + 'T00:00:00') : undefined}
              />
            ) : (
              <Calendar
                mode="range"
                start={props.start}
                end={props.end}
                onChange={(s, e) => {
                  props.onChange(s, e);
                  if (s && e) setOpen(false);
                }}
                minDate={props.minDate}
                maxDate={props.maxDate}
                initialMonth={props.start ? new Date(props.start + 'T00:00:00') : undefined}
              />
            )}
          </div>
        </IonContent>
      </IonModal>
    </>
  );
};
