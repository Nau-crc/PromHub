export const DAYS_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
export const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const WEEKDAYS_ALL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
export const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Always recompute "today" on demand so a long-lived session that crosses
// midnight stays accurate. Use `today()` instead of caching at module-load time.
export const today = (): Date => new Date();

export interface CountryCode { flag: string; code: string }

export const COUNTRY_CODES: CountryCode[] = [
  { flag: '🇪🇸', code: '+34' }, { flag: '🇬🇧', code: '+44' }, { flag: '🇫🇷', code: '+33' },
  { flag: '🇩🇪', code: '+49' }, { flag: '🇮🇹', code: '+39' }, { flag: '🇵🇹', code: '+351' },
  { flag: '🇺🇸', code: '+1' }, { flag: '🇲🇽', code: '+52' }, { flag: '🇦🇷', code: '+54' },
  { flag: '🇧🇷', code: '+55' }, { flag: '🇳🇱', code: '+31' },
];

// Half-hour 24h options
export function timeOptions(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}

export const STORAGE_KEYS = {
  state: 'promhub.state.v1',
  onboarded: 'promhub.onboarded.v1',
} as const;
