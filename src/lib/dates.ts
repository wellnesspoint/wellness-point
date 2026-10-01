/**
 * Store-local (IST, UTC+5:30, no DST) day helpers. Servers run in UTC, so
 * bucketing by `toISOString()` put orders placed between 00:00 and 05:30 IST
 * on the previous day.
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of the IST calendar day containing `date`. */
export function istDayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant (UTC) at which the IST calendar day containing `date` began. */
export function istDayStart(date: Date): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS
  );
}
