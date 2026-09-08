import { WEEKDAYS, buildMonthGrid, formatMonth, type MonthDay } from "../month";

// 28px cells, full round, mono figures so every column lines up on its digits.
const dayClasses = "num label-l inline-flex size-7 items-center justify-center rounded-full";

type AmenityCalendarProps = {
  /** Today in Manila, from `month.ts`. Passed in rather than read here so the whole page agrees
   *  on the date even if a render straddles midnight. */
  today: Date;
};

/**
 * The amenity card: a real month, and nothing else.
 *
 * The grid is the one thing on Today that is true without a database — a date is computable — so
 * it is drawn in full, with today marked. Everything the canvas hangs off it is not: there is no
 * `bookings` table and no `amenities` table, so there are **no booking dots on the days, no
 * legend to explain dots that do not exist, and no list of the day's bookings**. A dot that could
 * only ever be absent, or a legend for it, would make the card look live while it is not.
 */
export function AmenityCalendar({ today }: AmenityCalendarProps) {
  const weeks = buildMonthGrid(today);

  return (
    // 360px is the canvas's width; `max-w` rather than `w-[360px]` because the card sits in a
    // fluid column below the portal's two-column breakpoint and a fixed 360 overflows the 22px
    // gutters on a small phone.
    <div className="w-full max-w-[360px] rounded-m border border-outline-variant bg-surface p-4">
      {/* A real `<table>`, not a `grid` of `<div>`s: a month is a grid of dates against weekdays,
          and the table gives a screen reader the column relationship, the caption and the row
          structure that a hand-rolled grid would have to re-declare in ARIA. `table-fixed` is
          what keeps the seven columns equal once one holds a two-digit number. */}
      <table className="w-full table-fixed border-collapse">
        <caption className="title-m pb-3 text-left text-on-surface">{formatMonth(today)}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              // The visible letter is ambiguous by design — S and S, T and T — so the column's
              // name for a screen reader is the full weekday, and the letter is hidden from it.
              <th key={weekday.name} scope="col" className="label-m pb-1 text-on-surface-variant">
                <span aria-hidden="true">{weekday.narrow}</span>
                <span className="sr-only">{weekday.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            // Keyed on the week's own first date; the `?.` is `noUncheckedIndexedAccess`
            // talking, not a week that could come back short — every one holds seven days.
            <tr key={week[0]?.iso}>
              {week.map((day) => (
                <td key={day.iso} className="p-0.5 text-center">
                  <DayCell day={day} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="body-m mt-4 border-t border-outline-variant pt-3 text-on-surface-variant">
        No bookings to show — the amenities and bookings modules are not built yet. Until they are,
        this is a calendar and nothing more.
      </p>
    </div>
  );
}

/**
 * One day.
 *
 * `bg-primary` / `text-on-primary` for today, which is a pair with room to spare in both themes —
 * and deliberately not `primary-container`, which is the brand green `#8dc63f` in *both* schemes
 * and needs `on-primary-container` named explicitly to stay legible (`AmenitiesSection.tsx`
 * records the same trap on the landing page).
 */
function DayCell({ day }: { day: MonthDay }) {
  if (day.isToday) {
    return (
      <time
        dateTime={day.iso}
        aria-current="date"
        className={`${dayClasses} bg-primary text-on-primary`}
      >
        {day.dayOfMonth}
      </time>
    );
  }

  // The neighbouring months' days at M3's 38% disabled opacity: present, because a week that
  // stops mid-row reads as missing data, and quiet, because they are not this month.
  return (
    <time
      dateTime={day.iso}
      className={`${dayClasses} text-on-surface ${day.inMonth ? "" : "opacity-[0.38]"}`}
    >
      {day.dayOfMonth}
    </time>
  );
}
