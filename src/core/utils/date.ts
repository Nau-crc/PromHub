import { DAYS_FULL, MONTHS_FULL, WEEKDAYS_ALL, TODAY } from '../constants';

export const fmtDateLong = (d: Date): string =>
  `${DAYS_FULL[d.getDay()]}, ${MONTHS_FULL[d.getMonth()]} ${d.getDate()}`;

export const todayWeekday = (): string => WEEKDAYS_ALL[TODAY.getDay()];
