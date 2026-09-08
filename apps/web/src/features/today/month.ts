/**
 * The month grid behind Today's amenity card — the one part of that card that needs no table.
 *
 * Pure, no React and no I/O: dates in, cells out. It is here rather than inside the component
 * because a calendar that is off by one day, or that starts its weeks on the wrong day, looks
 * entirely plausible on the screen, and this is the half a test runner could drive the day one
 * lands.
 *
 * **Every `Date` in this module is midnight UTC carrying a *Manila* calendar date**, and every
 * formatter therefore passes `timeZone: "UTC"`. That is the trick the whole file turns on: with
 * the calendar fields moved into UTC once, day arithmetic is plain UTC arithmetic and the server's
 * own timezone stops mattering. Format one of these dates without `timeZone: "UTC"` and it shifts
 * back by whatever the host is set to — a Vercel box runs UTC, so the bug would appear only after
 * 4pm Manila time, and only in production.
 */

// The Philippines has kept UTC+8 with no daylight saving since 1978, so a fixed offset is exact
// here in a way it would not be for a market that observes DST. `Intl` knows the zone too, but it
// can only *format* — it cannot hand back the calendar fields to do arithmetic on without parsing
// its own output back out again, which is the fragile half of the obvious alternative.
const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * The strip above the grid, in the order the grid lays its columns out.
 *
 * Sunday-first, the Philippine convention. It lives beside {@link buildMonthGrid} rather than in
 * the component for one reason: `Date.getUTCDay()` counts from Sunday, so the grid's leading pad
 * *is* that number, and a strip that started on Monday would be silently off by one against a
 * grid that did not.
 */
export const WEEKDAYS = [
  { narrow: "S", name: "Sunday" },
  { narrow: "M", name: "Monday" },
  { narrow: "T", name: "Tuesday" },
  { narrow: "W", name: "Wednesday" },
  { narrow: "T", name: "Thursday" },
  { narrow: "F", name: "Friday" },
  { narrow: "S", name: "Saturday" },
] as const;

/** One cell of the grid. */
export type MonthDay = {
  /** `YYYY-MM-DD`, for the cell's `<time dateTime>`. */
  iso: string;
  dayOfMonth: number;
  /** False for the days either side that pad the first and last weeks out to seven. */
  inMonth: boolean;
  isToday: boolean;
};

/** Today in Manila, as midnight UTC on that calendar date. */
export function manilaToday(now: Date): Date {
  const shifted = new Date(now.getTime() + MANILA_UTC_OFFSET_MS);

  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** A date from this module as `YYYY-MM-DD`, which is also the `<time dateTime>` format. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "September 2026" — the calendar's caption. */
export function formatMonth(date: Date): string {
  return monthFormat.format(date);
}

/** "Tuesday, September 8" — the lede's eyebrow. */
export function formatDayLong(date: Date): string {
  return dayLongFormat.format(date);
}

/**
 * `today`'s whole month as weeks of seven days, padded at both ends with the neighbouring
 * months' days so every week is full.
 *
 * Exactly as many weeks as the month spans — four, five or six — rather than a fixed six. A
 * calendar that cannot be paged to another month has no layout to keep stable, so a sixth row of
 * nothing but greyed-out days would be a row of noise.
 */
export function buildMonthGrid(today: Date): readonly (readonly MonthDay[])[] {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  // Day 0 of the next month is the last day of this one, which is how the length of February
  // stays the calendar's problem rather than this function's.
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // `getUTCDay()` counts from Sunday, and so does WEEKDAYS, so the first of the month sits that
  // many columns in and the pad before it is the same number.
  const leading = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const weeks = Math.ceil((leading + daysInMonth) / 7);
  const todayIso = toIsoDate(today);

  // `Date.UTC` normalises a day-of-month outside the month it is given — `1 - leading` walks back
  // into the previous month, and past the end walks into the next — so no cell needs a special
  // case and none can land on an impossible date.
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const date = new Date(Date.UTC(year, month, 1 - leading + week * 7 + weekday));
      const iso = toIsoDate(date);

      return {
        iso,
        dayOfMonth: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month,
        isToday: iso === todayIso,
      };
    }),
  );
}

// Built once at module scope rather than per render: an `Intl.DateTimeFormat` is expensive to
// construct and these two take no argument that varies.
const monthFormat = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayLongFormat = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
