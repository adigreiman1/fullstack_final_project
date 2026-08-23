/**
 * The timezone the service fleet actually operates in.
 *
 * "Today" has to be resolved in a fixed timezone, not the server's. A server in
 * UTC asked for "today" at 01:00 Israel time would return yesterday's tasks and
 * the dashboard would look empty at the start of a shift.
 */
export const SERVICE_TIMEZONE = 'Asia/Jerusalem';

/** Today's date as 'YYYY-MM-DD' in the fleet's timezone, matching a Postgres `date`. */
export function todayInServiceTimezone(now: Date = new Date()): string {
  // 'en-CA' formats as YYYY-MM-DD, which is exactly the Postgres date literal format.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SERVICE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/*
 * Calendar arithmetic below.
 *
 * A 'YYYY-MM-DD' here is a *calendar date*, not an instant, so every conversion
 * goes through Date.UTC and every read uses the getUTC* accessors. Using local
 * time instead would shift dates by a day for anyone west of UTC, and would break
 * outright across a DST boundary — `new Date('2026-03-27')` is midnight UTC, which
 * is still 26 March in the Americas.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a well-formed 'YYYY-MM-DD' that is also a real calendar date. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  // Round-trip catches 2026-02-30 and friends, which the regex happily accepts.
  return toIsoDate(fromIsoDate(value)) === value;
}

/** Parses 'YYYY-MM-DD' into a UTC-midnight Date. Assumes isIsoDate() has passed. */
export function fromIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Shifts a calendar date by whole days. Negative moves backwards. */
export function addDays(value: string, days: number): string {
  const date = fromIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/** Shifts by whole months, clamping the day: 31 Jan + 1 month = 28/29 Feb. */
export function addMonths(value: string, months: number): string {
  const date = fromIsoDate(value);
  const targetMonth = date.getUTCMonth() + months;
  const clamped = new Date(Date.UTC(date.getUTCFullYear(), targetMonth, 1));
  const daysInTarget = new Date(
    Date.UTC(clamped.getUTCFullYear(), clamped.getUTCMonth() + 1, 0),
  ).getUTCDate();

  clamped.setUTCDate(Math.min(date.getUTCDate(), daysInTarget));
  return toIsoDate(clamped);
}

export interface CalendarDay {
  date: string;
  /** False for the leading/trailing days borrowed from the adjacent months. */
  inCurrentMonth: boolean;
}

/**
 * The six-week grid for the month containing `value`, Sunday-first.
 *
 * Always 42 cells: a fixed height stops the dropdown from resizing as you page
 * through months. Sunday-first because the fleet works an Israeli week.
 */
export function monthGrid(value: string): CalendarDay[] {
  const anchor = fromIsoDate(value);
  const firstOfMonth = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const gridStart = addDays(toIsoDate(firstOfMonth), -firstOfMonth.getUTCDay());
  const currentMonth = anchor.getUTCMonth();

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return { date, inCurrentMonth: fromIsoDate(date).getUTCMonth() === currentMonth };
  });
}

/*
 * Formatters are locked to he-IL rather than the runtime's locale: the
 * dashboard is Hebrew-only, and on the server the runtime locale is the
 * machine's, which is nobody's preference.
 *
 * timeZone: 'UTC' throughout, because these values are UTC-midnight stand-ins for
 * calendar dates — formatting them in any other zone can print the day before.
 */

const LOCALE = 'he-IL';

/** 'יום ה׳, 13 באוג׳ 2026' — the header's primary label. */
export function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(fromIsoDate(value));
}

/** 'אוגוסט 2026' — the calendar dropdown's month heading. */
export function formatMonthYear(value: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(fromIsoDate(value));
}

/**
 * Weekday column headers, Sunday-first.
 *
 * 'narrow' rather than the first letter of the long name: Hebrew weekday names
 * all begin with the same word ('יום ראשון', 'יום שני'), so slicing would print
 * seven identical columns. Narrow gives 'א', 'ב', 'ג' as intended.
 */
export function weekdayInitials(): { key: string; label: string; full: string }[] {
  const narrow = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'narrow' });
  const long = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'long' });

  // 2026-08-02 is a Sunday, used purely as a known week start.
  return Array.from({ length: 7 }, (_, index) => {
    const iso = addDays('2026-08-02', index);
    const date = fromIsoDate(iso);
    // Keyed by the ISO date, not the label: narrow weekday names repeat
    // ('S' for Saturday and Sunday), which would collide as React keys.
    return { key: iso, label: narrow.format(date), full: long.format(date) };
  });
}

/** Which relative day this is, if any. The caller supplies the wording. */
export type RelativeDay = 'today' | 'yesterday' | 'tomorrow';

export function relativeDay(value: string, today: string): RelativeDay | null {
  if (value === today) return 'today';
  if (value === addDays(today, -1)) return 'yesterday';
  if (value === addDays(today, 1)) return 'tomorrow';
  return null;
}
