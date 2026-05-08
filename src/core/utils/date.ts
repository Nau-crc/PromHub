import { DAYS_FULL, MONTHS_FULL, WEEKDAYS_ALL, today } from '../constants';

export const fmtDateLong = (d: Date): string =>
  `${DAYS_FULL[d.getDay()]}, ${MONTHS_FULL[d.getMonth()]} ${d.getDate()}`;

export const todayWeekday = (): string => WEEKDAYS_ALL[today().getDay()];

// ISO yyyy-mm-dd for a given Date — used as the canonical day key
export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
