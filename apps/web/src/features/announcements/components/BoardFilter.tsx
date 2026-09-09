import Link from "next/link";

/**
 * The status filter: an M3 segmented button, drawn as links rather than toggle buttons — every
 * segment's `href` already carries the URL a click should land on, so the whole control needs no
 * `"use client"` and no `aria-pressed` state to hold. `aria-current="true"` says which segment
 * is current, the same token `DestinationLink.tsx` reserves for "the current item in a set that
 * is not a page" rather than the `"page"` value a full route change would use.
 *
 * Track and boundary shapes copy `StatementCard.tsx`'s segmented toggle exactly — `border-outline`
 * on the track and the interior dividers, `rounded-*-full` on the end segments so the pointer
 * target is never clipped. **The selected segment carries no state layer**: `secondary-container`
 * `/` `on-secondary-container` measures 4.54 light / 4.52 dark, with none of that headroom to
 * spend on an 8% hover wash, so `m3-state` sits only on the unselected segments — the one action
 * this control offers.
 */

export type BoardFilterSegment = {
  key: string;
  label: string;
  count: number;
  href: string;
  selected: boolean;
};

const trackClasses = "inline-flex h-10 rounded-full border border-outline";

const segmentBase = "m3-target inline-flex items-center gap-2 px-4 label-l";

type BoardFilterProps = {
  filters: readonly BoardFilterSegment[];
};

export function BoardFilter({ filters }: BoardFilterProps) {
  return (
    <div role="group" aria-label="Filter by status" className={trackClasses}>
      {filters.map((filter, index) => (
        <Link
          key={filter.key}
          href={filter.href}
          aria-current={filter.selected ? "true" : undefined}
          className={[
            segmentBase,
            index === 0 ? "rounded-l-full" : "border-l border-outline",
            index === filters.length - 1 ? "rounded-r-full" : "",
            filter.selected
              ? "bg-secondary-container text-on-secondary-container"
              : "m3-state text-on-surface-variant",
          ].join(" ")}
        >
          {filter.selected && <CheckGlyph />}
          {filter.label}
          <span className="num">{filter.count}</span>
        </Link>
      ))}
    </div>
  );
}

// The selected segment's leading check, at M3's 18px — `CheckGlyph` in `StatementCard.tsx`,
// transcribed rather than imported: that copy is a client component's local function, not an
// exported one, and a segmented control this small does not earn a shared icon module of its own.
function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 18 18"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.75 9.25 7.25 12.75 14.25 5.75" />
    </svg>
  );
}
