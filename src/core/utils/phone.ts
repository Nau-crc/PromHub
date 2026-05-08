// ─────────────────────────────────────────────────────────────
//  Lightweight per-country phone digit length validation.
//
//  We're not using libphonenumber-js (~100KB gzipped) because we
//  only need basic format validation for the country codes we
//  expose in the picker. Each entry declares:
//    digits      — exact total digit count (excluding country code)
//    placeholder — user-facing example formatted local number
//    format      — chunk sizes for spacing as the user types
//                  e.g. [3,3,3] formats "612345678" as "612 345 678"
//
//  When a country isn't in the table we fall back to "any 6–14
//  digits" so we don't block legitimate numbers in unmapped regions.
// ─────────────────────────────────────────────────────────────

export interface PhoneRule {
  /** Acceptable lengths (digits, excluding country code). */
  digits: number | number[];
  placeholder: string;
  format: number[];
}

const RULES: Record<string, PhoneRule> = {
  '+34':  { digits: 9,        placeholder: '612 345 678',     format: [3, 3, 3] },          // ES
  '+44':  { digits: [10, 11], placeholder: '7700 123456',     format: [4, 6] },             // UK
  '+33':  { digits: 9,        placeholder: '6 12 34 56 78',   format: [1, 2, 2, 2, 2] },    // FR
  '+49':  { digits: [10, 11], placeholder: '170 1234567',     format: [3, 7] },             // DE
  '+39':  { digits: [9, 10],  placeholder: '312 345 6789',    format: [3, 3, 4] },          // IT
  '+351': { digits: 9,        placeholder: '912 345 678',     format: [3, 3, 3] },          // PT
  '+1':   { digits: 10,       placeholder: '(415) 555-1234',  format: [3, 3, 4] },          // US/CA
  '+52':  { digits: 10,       placeholder: '55 1234 5678',    format: [2, 4, 4] },          // MX
  '+54':  { digits: 10,       placeholder: '11 1234 5678',    format: [2, 4, 4] },          // AR
  '+55':  { digits: [10, 11], placeholder: '11 91234 5678',   format: [2, 5, 4] },          // BR
  '+31':  { digits: 9,        placeholder: '6 1234 5678',     format: [1, 4, 4] },          // NL
};

/** Returns only the digits in the input (strips spaces, dashes, parens). */
export const onlyDigits = (s: string): string => s.replace(/\D+/g, '');

/** True when the digit-only number satisfies the country's expected length(s). */
export function isValidPhone(code: string, raw: string): boolean {
  const digits = onlyDigits(raw);
  const rule = RULES[code];
  if (!rule) return digits.length >= 6 && digits.length <= 14;
  const allowed = Array.isArray(rule.digits) ? rule.digits : [rule.digits];
  return allowed.includes(digits.length);
}

/** Insert spaces according to the country's chunking rule. */
export function formatPhone(code: string, raw: string): string {
  const digits = onlyDigits(raw);
  const rule = RULES[code];
  if (!rule) return digits;
  const out: string[] = [];
  let cursor = 0;
  for (const size of rule.format) {
    if (cursor >= digits.length) break;
    out.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }
  if (cursor < digits.length) out.push(digits.slice(cursor));
  return out.join(' ');
}

/** User-facing example phone for the placeholder. */
export const placeholderForCode = (code: string): string =>
  RULES[code]?.placeholder ?? '612 345 678';

/** Maximum allowed digit count (used to cap the input). */
export function maxDigits(code: string): number {
  const rule = RULES[code];
  if (!rule) return 14;
  return Array.isArray(rule.digits) ? Math.max(...rule.digits) : rule.digits;
}
