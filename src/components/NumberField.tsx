import React from 'react';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Numeric value, or `null` when the field is empty. */
  value: number | null;
  /** Called with `null` when the user clears the field. */
  onChange: (value: number | null) => void;
  /** Accept decimals if true. Defaults to integer-only. */
  decimal?: boolean;
}

// ─────────────────────────────────────────────────────────────
//  Clearable number input. The native `<input type=number>` with
//  `value={n}` + `onChange={parseInt(...) || 0}` makes the field
//  un-clearable: any empty string is coerced back to 0 (or 1).
//
//  This component instead stores `null` for "empty" and only emits
//  numeric values once the user actually types a digit.
// ─────────────────────────────────────────────────────────────
export const NumberField: React.FC<Props> = ({ value, onChange, decimal = false, ...rest }) => {
  return (
    <input
      {...rest}
      type="number"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={value === null || value === undefined || Number.isNaN(value) ? '' : value}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') return onChange(null);
        const n = decimal ? parseFloat(raw) : parseInt(raw, 10);
        if (Number.isNaN(n)) return onChange(null);
        onChange(n);
      }}
    />
  );
};
