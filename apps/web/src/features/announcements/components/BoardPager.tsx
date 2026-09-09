import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The pagination footer, inside the table's card and under a divider — it belongs to the table,
 * not the page. "Rows per page" and its size menu sit on the left; the total, then
 * first · previous · position · next · last, on the right. Page and page size both arrive as
 * `href`s already built by `(portal)/announcements/page.tsx`, so this stays a Server Component:
 * there is no state here to hold, only links to draw.
 *
 * **The rows-per-page menu is a native `<details>`/`<summary>` disclosure, not a hand-rolled
 * one.** The design draws an M3 menu anchored to a button, which needs open/close state — the
 * one place on this page a client component looked unavoidable. `<details>` gives the same
 * anchored-panel shape with no JavaScript and no `"use client"`: the browser owns open/closed,
 * and what closes it is a real navigation to a new URL, exactly like every other control here.
 *
 * **First and previous are `aria-disabled`, never `disabled`, on page one — same as last and
 * next on the last page.** `NavigationDrawer.tsx`'s planned destinations are the precedent:
 * `disabled` drops a control out of the tab order, and a keyboard user who cannot reach the
 * position readout has lost more than a dead button.
 */

export type PageSizeOption = {
  value: number;
  href: string;
  selected: boolean;
};

type BoardPagerProps = {
  pageSizeOptions: readonly PageSizeOption[];
  currentPageSize: number;
  totalCount: number;
  page: number;
  pageCount: number;
  firstHref: string | null;
  prevHref: string | null;
  nextHref: string | null;
  lastHref: string | null;
};

const navButtonClasses =
  "m3-target inline-flex size-12 items-center justify-center rounded-full text-on-surface-variant";

export function BoardPager({
  pageSizeOptions,
  currentPageSize,
  totalCount,
  page,
  pageCount,
  firstHref,
  prevHref,
  nextHref,
  lastHref,
}: BoardPagerProps) {
  return (
    <div className="relative flex items-center gap-4 border-t border-outline-variant py-2 pr-2 pl-4">
      <span className="body-m text-on-surface-variant">Rows per page</span>

      <details className="group">
        <summary
          className={
            "m3-target inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-full " +
            "border border-primary px-4 text-on-surface [&::-webkit-details-marker]:hidden"
          }
        >
          <span className="label-l num">{currentPageSize}</span>
          <ChevronDownGlyph />
        </summary>

        {/* Opens upward, over the last rows, because it is anchored to a control at the bottom
            of the table. `role="menu"`/`role="menuitem"` rather than the canvas's listbox pair:
            each option is a real navigation, not a value a script assigns, and a menu of links is
            what that actually is. */}
        <nav aria-label="Rows per page" className="absolute bottom-12 left-4 z-10">
          <ul
            role="menu"
            className="w-[116px] rounded-xs bg-surface-container py-2 shadow-[var(--md-elev-2)]"
          >
            {pageSizeOptions.map((option) => (
              <li key={option.value} role="none">
                <Link
                  role="menuitem"
                  href={option.href}
                  aria-current={option.selected ? "true" : undefined}
                  className={
                    "flex h-12 items-center justify-between px-3 label-l num " +
                    (option.selected
                      ? "bg-secondary-container text-on-secondary-container"
                      : "m3-state text-on-surface")
                  }
                >
                  {option.value}
                  {option.selected && <CheckGlyph />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </details>

      <span className="flex-1" />

      <span className="body-m num text-on-surface-variant">{totalCount} total</span>

      <nav aria-label="Pagination" className="flex items-center">
        <PagerButton href={firstHref} label="First page">
          <FirstPageGlyph />
        </PagerButton>
        <PagerButton href={prevHref} label="Previous page">
          <PreviousPageGlyph />
        </PagerButton>

        <span className="body-m num min-w-14 px-2 text-center text-on-surface">
          {page} / {pageCount}
        </span>

        <PagerButton href={nextHref} label="Next page">
          <NextPageGlyph />
        </PagerButton>
        <PagerButton href={lastHref} label="Last page">
          <LastPageGlyph />
        </PagerButton>
      </nav>
    </div>
  );
}

/** One end of the nav strip: a link when there is somewhere to go, an inert-but-reachable button
 * when there is not. */
function PagerButton({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: ReactNode;
}) {
  if (href === null) {
    return (
      <button
        type="button"
        aria-disabled="true"
        aria-label={label}
        className={`${navButtonClasses} opacity-[0.38]`}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href={href} aria-label={label} className={`${navButtonClasses} m3-state`}>
      {children}
    </Link>
  );
}

// Every glyph below is hand-authored inline SVG on the `CheckGlyph` precedent in
// `StatementCard.tsx`, transcribed from `Announcements.dc.html`'s own pager.

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function ChevronDownGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="var(--md-on-surface-variant)"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 8.5 12 14.5 18 8.5" />
    </svg>
  );
}

function FirstPageGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.5 6l-6 6 6 6M7 6v12" />
    </svg>
  );
}

function PreviousPageGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14.5 6l-6 6 6 6" />
    </svg>
  );
}

function NextPageGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9.5 6l6 6-6 6" />
    </svg>
  );
}

function LastPageGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.5 6l6 6-6 6M17 6v12" />
    </svg>
  );
}
