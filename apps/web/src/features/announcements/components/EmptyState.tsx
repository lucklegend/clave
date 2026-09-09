import type { ReactNode } from "react";

/**
 * The board with nothing on it — what a village actually sees on day one, and the state
 * `Announcements.dc.html` draws in full rather than describes. The chrome (56px icon circle on
 * `surface-container-high`, `title-m` heading, centred `body-m` up to 46ch, an optional CTA) is
 * `WorkQueue.tsx`'s empty-queue card scaled up to a page-level announcement, on the same
 * `rounded-m border border-outline-variant` card every other block on this page uses.
 *
 * Two callers, two messages. `variant="day-one"` is the design's own copy for a village with no
 * announcements at all, and carries its own "New announcement" button — the page's top-level
 * button already offers the same action, but a first-run empty state earning its own focal CTA
 * is ordinary product practice, not a duplicate to prune. `variant="filtered"` is what a manager
 * sees choosing "Drafts" on a board with none: the design does not draw this case, so the copy
 * here is written to match its register rather than invented as an afterthought — no button,
 * because the way out of an empty filter is the filter itself, not a new post.
 */

type EmptyStateProps =
  | { variant: "day-one"; villageName: string; cta: ReactNode }
  | { variant: "filtered"; filterLabel: string };

export function EmptyState(props: EmptyStateProps) {
  return (
    <div className="rounded-m border border-outline-variant bg-surface px-6 py-12">
      <div className="mx-auto flex max-w-[46ch] flex-col items-center gap-1 text-center">
        <span className="mb-2 inline-flex size-14 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
          <MegaphoneGlyph />
        </span>

        {props.variant === "day-one" ? (
          <>
            <p className="title-m text-on-surface">
              Nothing has been posted to {props.villageName} yet.
            </p>
            <p className="body-m mb-4 text-on-surface-variant">
              Write the first one. You can save it as a draft and come back to it, or set it to go
              out at a time you choose.
            </p>
            {props.cta}
          </>
        ) : (
          <>
            <p className="title-m text-on-surface">No {props.filterLabel} announcements.</p>
            <p className="body-m text-on-surface-variant">
              Nothing on this board matches that filter right now. Choose All to see everything that
              has been posted.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// The megaphone, 28px, transcribed from the design's own empty-state icon rather than pulled
// from `AnnouncementsIcon` in `icons.tsx` — that glyph answers to the subset icon font's fixed
// 24px axis defaults and this card draws its icon at 28px, so a hand-authored SVG on the
// `StatusBadge.tsx` precedent stays consistent with the canvas rather than fighting the font.
function MegaphoneGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9.5v5h3l6 4V5.5l-6 4H4z" />
      <path d="M17 9.2a4 4 0 0 1 0 5.6" />
    </svg>
  );
}
