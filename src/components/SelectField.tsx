import React, { useState } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';

// ─────────────────────────────────────────────────────────────
//  Custom select field rendered as a button + sheet picker.
//
//  Why not <select>: native HTML selects render their dropdown
//  through the OS chrome — on iOS that means a bottom sheet
//  (which can collide with our IonModal sheets), on Android it
//  varies by browser. By owning the dropdown UI we get:
//   - identical visuals across iOS, Android, web
//   - dark-mode support without fighting native styles
//   - correct stacking inside our IonModal sheets
//
//  The trigger looks exactly like .form-input / .form-select so
//  it slots into existing layouts.
// ─────────────────────────────────────────────────────────────

export interface SelectOption<V extends string | number = string> {
  value: V;
  label: string;
  /** Optional secondary line shown under the label. */
  sub?: string;
  /** When true the option is rendered greyed-out and not selectable. */
  disabled?: boolean;
}

export interface SelectFieldProps<V extends string | number> {
  value: V | null;
  onChange: (value: V) => void;
  options: SelectOption<V>[];
  /** Placeholder shown when no option matches `value`. */
  placeholder?: string;
  /** Title in the picker sheet. */
  title?: string;
  /** Optional className for the trigger (defaults to .form-select). */
  className?: string;
  style?: React.CSSProperties;
  /** Disable the whole field. */
  disabled?: boolean;
}

export function SelectField<V extends string | number>({
  value, onChange, options, placeholder = '—',
  title, className = 'form-select', style, disabled,
}: SelectFieldProps<V>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const resolvedTitle = title ?? t('common.pickAVenue');
  const current = options.find((o) => o.value === value);
  const display = current?.label ?? placeholder;

  return (
    <>
      <button
        type="button"
        className={className}
        style={{
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          // Replicate the native dropdown chevron
          backgroundImage:
            'linear-gradient(45deg, transparent 50%, var(--color-text-secondary) 50%), ' +
            'linear-gradient(135deg, var(--color-text-secondary) 50%, transparent 50%)',
          backgroundPosition: 'calc(100% - 16px) 50%, calc(100% - 11px) 50%',
          backgroundSize: '5px 5px',
          backgroundRepeat: 'no-repeat',
          paddingRight: 28,
          ...style,
        }}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        {display}
      </button>

      <IonModal
        isOpen={open}
        onDidDismiss={() => setOpen(false)}
        initialBreakpoint={0.75}
        breakpoints={[0, 0.5, 0.75, 1]}
      >
        <IonContent>
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            position: 'sticky', top: 0, background: 'var(--color-background-primary)', zIndex: 10,
          }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {resolvedTitle}
            </div>
            <button className="btn-close" aria-label={t('components.closeAria')} onClick={() => setOpen(false)}>✕</button>
          </div>

          <div style={{ padding: 16 }}>
            {options.length ? options.map((o) => {
              const selected = o.value === value;
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  className={`event-picker-item ${selected ? 'sel' : ''}`}
                  onClick={() => {
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                  }}
                  disabled={o.disabled}
                  style={{
                    width: '100%',
                    opacity: o.disabled ? 0.45 : 1,
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div className="event-picker-info">
                    <div className="event-picker-name">{o.label}</div>
                    {o.sub && <div className="event-picker-sub">{o.sub}</div>}
                  </div>
                  <div className="event-picker-check">{selected ? '✓' : ''}</div>
                </button>
              );
            }) : (
              <div style={{
                padding: '20px 12px', textAlign: 'center',
                color: 'var(--color-text-secondary)', fontSize: 13,
              }}>
                No options.
              </div>
            )}
          </div>
        </IonContent>
      </IonModal>
    </>
  );
}
