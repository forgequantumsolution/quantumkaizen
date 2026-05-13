/**
 * Business-calendar arithmetic for SLA deadlines.
 *
 * `addBusinessSeconds(from, seconds, calendar)` returns the wall-clock instant
 * that lies `seconds` of working time after `from`, respecting:
 *   - the calendar's weekly schedule (mon-sun, each `{ start, end }` or null)
 *   - the calendar's holiday list (ISO YYYY-MM-DD strings in the calendar's TZ)
 *   - the calendar's timezone (for "what day is it" / "what local time" decisions)
 *
 * If `calendar` is null we fall back to wall-clock (24x7).
 *
 * Implementation: iterative day-walk in the calendar's timezone. Each day
 * contributes (end - start) working seconds; we deduct from `seconds` until
 * it fits inside a single day, then return that day's start + remaining.
 *
 * DST: implemented via per-day offset lookup, so a calendar that spans a DST
 * boundary picks up the correct local time. The single-iteration offset can
 * be off by ±1h at the exact transition minute; treat that as an SLA non-issue.
 */

export type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

const WEEK_DAYS: WeekDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export interface DayHours {
  start: string; // "HH:MM" (24h)
  end: string;   // "HH:MM" (24h)
}

export type WeeklySchedule = Partial<Record<WeekDay, DayHours | null>>;

export interface BusinessCalendarRef {
  timezone: string;          // IANA, e.g. "Asia/Kolkata"
  weeklySchedule: WeeklySchedule;
  holidays: string[];        // ["2026-01-26", ...] in calendar local TZ
}

const MS_PER_SEC = 1000;
const SEC_PER_DAY = 24 * 60 * 60;

// ─── timezone helpers ──────────────────────────────────────────────────────

/** Minutes offset of `tz` from UTC at instant `at`. Positive east of UTC. */
const tzOffsetMin = (at: Date, tz: string): number => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(at).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const localAsUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((localAsUtcMs - at.getTime()) / 60000);
};

/** Returns {date: "YYYY-MM-DD", weekday: WeekDay, hour, minute, second} in `tz`. */
const partsInTz = (at: Date, tz: string) => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(
    dtf.formatToParts(at).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  // `weekday: 'short'` returns "Mon", "Tue", ... — lowercase 3-char matches our WeekDay union.
  const weekday = p.weekday!.toLowerCase().slice(0, 3) as WeekDay;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday,
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
};

/** UTC instant corresponding to a wall-clock time on `dateStr` (YYYY-MM-DD) in `tz`. */
const wallClockToUtc = (dateStr: string, hhmm: string, tz: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  // First approximation: treat the wall clock as UTC, then back out the offset.
  const approx = new Date(Date.UTC(y!, m! - 1, d!, hh!, mm!));
  const offsetMin = tzOffsetMin(approx, tz);
  return new Date(approx.getTime() - offsetMin * 60000);
};

const addDays = (dateStr: string, n: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
};

// ─── per-day window resolution ─────────────────────────────────────────────

const hoursAtSec = (hhmm: string): number => {
  const [hh, mm] = hhmm.split(':').map(Number);
  return hh! * 3600 + mm! * 60;
};

/**
 * For the given calendar-local date `dateStr`, returns the working window as
 * UTC Dates {start, end}, OR `null` if the day is non-working (holiday or
 * weekday off).
 */
const workingWindow = (
  dateStr: string,
  weekday: WeekDay,
  cal: BusinessCalendarRef,
): { start: Date; end: Date } | null => {
  if (cal.holidays.includes(dateStr)) return null;
  const dayHours = cal.weeklySchedule[weekday];
  if (!dayHours) return null;
  return {
    start: wallClockToUtc(dateStr, dayHours.start, cal.timezone),
    end: wallClockToUtc(dateStr, dayHours.end, cal.timezone),
  };
};

// ─── public API ────────────────────────────────────────────────────────────

/**
 * Add `seconds` of business time to `from`, respecting the calendar.
 *
 * Wall-clock fallback when `calendar` is null. Hard cap of 366 days walked
 * forward to defeat infinite loops on pathological inputs (all-holiday years).
 */
export const addBusinessSeconds = (
  from: Date,
  seconds: number,
  calendar: BusinessCalendarRef | null,
): Date => {
  if (!calendar) return new Date(from.getTime() + seconds * MS_PER_SEC);
  if (seconds <= 0) return from;

  let remaining = seconds;
  let cursor = from;
  let safetyDays = 0;

  while (remaining > 0) {
    if (safetyDays++ > 366) {
      throw new Error(
        `addBusinessSeconds: walked 366 days without exhausting ${seconds}s — ` +
          `calendar may be entirely non-working`,
      );
    }
    const parts = partsInTz(cursor, calendar.timezone);
    const window = workingWindow(parts.date, parts.weekday, calendar);
    if (!window) {
      // Non-working day — jump to start of next day at 00:00 local.
      const nextDay = addDays(parts.date, 1);
      cursor = wallClockToUtc(nextDay, '00:00', calendar.timezone);
      continue;
    }
    // We're at `cursor`. Where does today's working day end?
    if (cursor.getTime() < window.start.getTime()) {
      // Before opening: jump forward to start.
      cursor = window.start;
    } else if (cursor.getTime() >= window.end.getTime()) {
      // After closing: jump to next day 00:00.
      const nextDay = addDays(parts.date, 1);
      cursor = wallClockToUtc(nextDay, '00:00', calendar.timezone);
      continue;
    }
    const availableSec = Math.floor((window.end.getTime() - cursor.getTime()) / MS_PER_SEC);
    if (remaining <= availableSec) {
      return new Date(cursor.getTime() + remaining * MS_PER_SEC);
    }
    remaining -= availableSec;
    // Jump to next day 00:00 local.
    cursor = wallClockToUtc(addDays(parts.date, 1), '00:00', calendar.timezone);
  }
  return cursor;
};

/**
 * Total business seconds elapsed from `from` to `until`. If `until <= from`
 * returns 0. Wall-clock fallback when calendar is null.
 */
export const elapsedBusinessSeconds = (
  from: Date,
  until: Date,
  calendar: BusinessCalendarRef | null,
): number => {
  if (until.getTime() <= from.getTime()) return 0;
  if (!calendar) return Math.floor((until.getTime() - from.getTime()) / MS_PER_SEC);

  let accumulated = 0;
  let cursor = from;
  let safetyDays = 0;

  while (cursor.getTime() < until.getTime()) {
    if (safetyDays++ > 366) {
      // Pathological — bail out gracefully; safer to underestimate than loop forever.
      return accumulated;
    }
    const parts = partsInTz(cursor, calendar.timezone);
    const window = workingWindow(parts.date, parts.weekday, calendar);
    if (!window) {
      cursor = wallClockToUtc(addDays(parts.date, 1), '00:00', calendar.timezone);
      continue;
    }
    // Effective day window = max(cursor, window.start) → min(until, window.end)
    const dayStart = Math.max(cursor.getTime(), window.start.getTime());
    const dayEnd = Math.min(until.getTime(), window.end.getTime());
    if (dayStart < dayEnd) {
      accumulated += Math.floor((dayEnd - dayStart) / MS_PER_SEC);
    }
    cursor = wallClockToUtc(addDays(parts.date, 1), '00:00', calendar.timezone);
  }
  return accumulated;
};

// Re-exported for callers (e.g. SLA handler computing pause math).
export const _internals_forTest = { SEC_PER_DAY, WEEK_DAYS };
