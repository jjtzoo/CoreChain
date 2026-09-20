import { isoToLocalDate } from '@corechain/domain';

/** A `YYYY-MM-DD` day as the phone's locale writes it, e.g. "20 Sep 2026". */
export function describeDay(isoDay: string): string {
  const date = isoToLocalDate(isoDay);
  return date
    ? date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : isoDay;
}
