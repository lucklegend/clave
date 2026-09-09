import type { JSX } from "react";
import type { AnnouncementDisplayStatus } from "../status";

/**
 * The Status column's whole cell content: the badge M3 draws as a fact rather than a control —
 * `StatementCard.tsx`'s "Open" tag is the precedent, `label-s … rounded-s` and no border unless
 * the tone itself has none to spend — stacked over the publish time it refers to in `body-s`, so
 * the two can never be read apart. `Announcements.dc.html`'s Status column is exactly this pair
 * in one cell.
 *
 * Every tone below is a fill token this scheme already defines; none is invented for this badge.
 * Published lands on `secondary-container` — the pair the M3 canvas flags with 0.04 of contrast
 * headroom (4.54 light / 4.52 dark) — so this component, like the filter segment and the drawer's
 * active row, composites no state layer on it. It is not a control, so it needed none anyway.
 */

type StatusToneClasses = {
  fill: string;
  Icon: () => JSX.Element;
};

const STATUS_TONE: Record<AnnouncementDisplayStatus, StatusToneClasses> = {
  draft: {
    fill: "bg-surface-container-highest text-on-surface-variant",
    Icon: DraftGlyph,
  },
  scheduled: {
    fill: "bg-tertiary-container text-on-tertiary-container",
    Icon: ScheduledGlyph,
  },
  published: {
    fill: "bg-secondary-container text-on-secondary-container",
    Icon: PublishedGlyph,
  },
  archived: {
    fill: "border border-outline text-on-surface-variant",
    Icon: ArchivedGlyph,
  },
} satisfies Record<AnnouncementDisplayStatus, StatusToneClasses>;

const STATUS_LABEL: Record<AnnouncementDisplayStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

// `Intl.DateTimeFormat` is expensive to construct, so this is built once at module scope rather
// than once per row — the same reasoning `today/month.ts` gives for its own formatters.
// `Asia/Manila`, not the server's zone: `publish_at` is a real instant, and the audience reading
// it is a Philippine HOA board, not the box the Next server happens to run in.
const publishTimeFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Manila",
});

type StatusBadgeProps = {
  status: AnnouncementDisplayStatus;
  /** `announcements.publish_at`. Null for a draft, and — see the time line below — for an
   * archived row too, whatever a fixture on the canvas shows. */
  publishAt: string | null;
};

export function StatusBadge({ status, publishAt }: StatusBadgeProps) {
  const { fill, Icon } = STATUS_TONE[status];

  return (
    <>
      <span
        className={`label-s inline-flex h-6 items-center gap-1 rounded-s px-2 whitespace-nowrap ${fill}`}
      >
        <Icon />
        {STATUS_LABEL[status]}
      </span>
      <span className="body-s num mt-1.5 block text-on-surface-variant">
        {publishTimeLine(status, publishAt)}
      </span>
    </>
  );
}

/**
 * The line under the badge. A draft reads "Not scheduled" — the design's exact copy — because it
 * has no publish time to show and never will until someone sets one. `announcements_publish_at_iff_published`
 * (`20260909120000_announcements.sql`) means an archived row cannot carry one either, even though
 * the canvas's illustrative archived row shows a timestamp — a fixture drawn before that
 * constraint was final, not a case this component can reach for real data. Both null cases render
 * the same dash rather than the draft's specific copy, since "not scheduled" is not what an
 * archived post's history means.
 */
function publishTimeLine(status: AnnouncementDisplayStatus, publishAt: string | null): string {
  if (status === "draft") {
    return "Not scheduled";
  }

  if (publishAt === null) {
    return "—";
  }

  return publishTimeFormat.format(new Date(publishAt));
}

// Every glyph below is 14px, hand-authored inline SVG on the `CheckGlyph` precedent in
// `StatementCard.tsx`: one more badge does not justify an icon package, and each has to answer to
// `currentColor` so it inherits the fill's own on-colour. `aria-hidden`, because the label text
// beside each glyph already carries the fact to a screen reader.

function DraftGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[14px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.5 19.5h15" />
      <path d="M6 15.5 15.5 6a2.1 2.1 0 0 1 3 3L9 18.5l-4 1z" />
    </svg>
  );
}

function ScheduledGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[14px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.4l2.8 1.8" />
    </svg>
  );
}

function PublishedGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[14px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function ArchivedGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[14px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <path d="M5.5 8.5v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-10M10 12.5h4" />
    </svg>
  );
}
