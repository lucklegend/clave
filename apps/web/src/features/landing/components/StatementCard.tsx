"use client";

import { useState } from "react";

type StatementLine = {
  label: string;
  meta: string;
  amount: number;
  /** Dues and board assessments follow the owner of record, so the tenant view drops them. */
  ownerOnly?: true;
};

// September for a fictional unit, transcribed from the artifact. The two `ownerOnly` lines are
// the only difference between the two views. Nothing below is written twice: the count, the
// total and the announcement all come off the filtered array, so they cannot drift from it.
const statementLines: readonly StatementLine[] = [
  {
    label: "HOA dues — September",
    meta: "assoc-dues · ₱15.68 / m² · owner of record",
    amount: 1850,
    ownerOnly: true,
  },
  {
    label: "Special assessment — perimeter lighting",
    meta: "6 of 12 · board res. 2026-03",
    amount: 625,
    ownerOnly: true,
  },
  {
    label: "Water — 14.2 m³",
    meta: "meter WM-0114 · 0812 → 0826 · tier 2",
    amount: 412.9,
  },
  {
    label: "Electricity — 236 kWh",
    meta: "meter EM-0114 · ₱11.60 / kWh + ₱30 systems loss",
    amount: 2767.6,
  },
  {
    label: "Clubhouse booking — 3 h",
    meta: "2026-09-19 · 14:00–17:00 · deposit applied",
    amount: 600,
  },
  {
    label: "Late fee",
    meta: "none — prior statement settled 2026-08-08",
    amount: 0,
  },
];

// Replaces the artifact's hand-rolled `toFixed().replace(/\B(?=(\d{3})+(?!\d))/g, ',')`.
// The ₱ sign is not part of the format: it sits outside the number so the tabular figures
// line up on their digits, as in the artifact.
const peso = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// M3's segmented button, single-select, two segments. The pill's ends are drawn by the segments'
// own end radii rather than by `overflow-hidden` on the track: a clip cuts `m3-target`'s expanded
// hit area along with the corners, and a segment whose pointer target stops at its painted edge is
// back below this repo's 44px floor. At this height the segments' `rounded-*-full` and the track's
// inner curve are the same 19px, so the shape is exactly the one the clip would have cut.
// The boundary is `outline`, never `outline-variant`: a divider may sit under 3:1, the boundary of
// a control may not (D4 rule 1).
const segmentTrackClasses = "inline-flex h-10 self-center rounded-full border border-outline";

// `m3-target` (globals.css) replaces the 44px minimum this control used to carry: the painted
// segment keeps M3's height and the pointer target grows 4px above and below it, to 46px, which
// clears the floor without making the pill taller.
//
// The state layer is scoped to the unselected segment, and the selected one deliberately gets
// none. `m3-state` mixes `currentColor` into transparency, which washes a tonal fill out rather
// than layering over it — and the M3 replacement, compositing the on-colour over the fill the way
// `filledButton` does, has no contrast budget to spend here. In this scheme
// `on-secondary-container` on `secondary-container` measures 4.54 light / 4.52 dark, and the label
// is `label-l` at 14px/500 — not WCAG large text, so the floor is 4.5 and the headroom is 0.04.
// An 8% hover layer of the on-colour spends it (4.13 / 3.93) and a 10% pressed layer more
// (4.02 / 3.81); so does any other tint that darkens the fill in light and lightens it in dark,
// `on-surface` included (3.88 / 3.74 at 8%). The only mixes that hold 4.5 push the fill *away*
// from its own label, which reads as the segment fading rather than lighting. M3 allows a
// segmented button whose selected segment carries no state layer, the fill and the check are the
// feedback, and the one action this control offers — switching to the other segment — is on the
// unselected one, which keeps `m3-state`.
//
// The focus ring is drawn inset: at the global +2px offset a segment's ring would land on the
// track's border and on its neighbour. −3px and not −2px, because the ring is now 3px wide.
const segmentClasses =
  "group inline-flex cursor-pointer items-center bg-transparent px-4 label-l " +
  "text-on-surface-variant m3-target aria-[pressed=false]:m3-state " +
  "focus-visible:[outline-offset:-3px] " +
  "aria-pressed:bg-secondary-container aria-pressed:text-on-secondary-container";

const headCellClasses = "label-m border-b border-outline-variant px-4 py-3 text-on-surface-variant";

const cellClasses = "body-m border-b border-outline-variant px-4 py-3";

// The check M3 puts on a selected segment, at its 18px. Hand-authored inline SVG on the precedent
// `ThemeToggle` set: one more glyph does not justify an icon package, and it has to answer to
// `currentColor`. `aria-hidden`, because `aria-pressed` already carries the selection to a screen
// reader — what the glyph carries is the same fact to everyone else, so selection is never colour
// on its own.
function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 18 18"
      className="mr-2 size-[18px] shrink-0"
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

// Selecting a segment grows it by the width of its check, and that growth is the page's one
// spatial transition. The width is animated on this wrapper rather than on the segment because a
// flex item sized by its content has no width to interpolate — `width: auto` does not transition.
// `m3-morph`'s spring overshoots 1, which is why it drives a width here and never a radius
// (globals.css).
const checkSlotClasses = "m3-morph inline-flex w-0 overflow-hidden group-aria-pressed:w-[26px]";

// The one stateful component on the page. It renders owner-side on the server — the superset of
// both views — so a failed hydration costs the switch and nothing else.
export function StatementCard() {
  const [view, setView] = useState<"owner" | "tenant">("owner");

  const lines = statementLines.filter((line) => view === "owner" || !line.ownerOnly);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <div className="rounded-l bg-surface-container-low shadow-[var(--md-elev-1)]">
      <div className="flex items-center gap-3 rounded-t-l bg-surface-container px-4 py-2.5">
        <span className="label-l text-on-surface-variant">Statement · 2026-09</span>
        {/* A status badge and deliberately not an M3 chip: a chip is interactive, and this states
            a fact. The fill is the whole signal, so it loses the border it used to draw. */}
        <span className="label-s ml-auto inline-flex h-6 items-center rounded-s bg-tertiary-container px-2 text-on-tertiary-container">
          Open
        </span>
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-b border-outline-variant px-4 py-3.5">
        <div>
          <div className="title-m text-on-surface">Unit B-14</div>
          <div className="body-s text-on-surface-variant">
            Casa Verde Village · Phase 2 · 118 m²
          </div>
        </div>
        {/* Two toggle buttons, not a radiogroup: both are tab stops, Enter and Space activate,
            and focus stays where it was pressed. M3 draws the same control as a segmented button,
            which is a change of clothes and not of shape. */}
        <div role="group" aria-label="Statement view" className={segmentTrackClasses}>
          <button
            type="button"
            aria-pressed={view === "owner"}
            onClick={() => setView("owner")}
            className={`${segmentClasses} rounded-l-full`}
          >
            <span aria-hidden="true" className={checkSlotClasses}>
              <CheckGlyph />
            </span>
            Owner
          </button>
          <button
            type="button"
            aria-pressed={view === "tenant"}
            onClick={() => setView("tenant")}
            className={`${segmentClasses} rounded-r-full border-l border-outline`}
          >
            <span aria-hidden="true" className={checkSlotClasses}>
              <CheckGlyph />
            </span>
            Tenant
          </button>
        </div>
      </div>

      {/* Pressing a toggle silently rewrites the table below it. "pesos" is spelled out because
          ₱ is read inconsistently across screen readers. */}
      <p role="status" aria-live="polite" className="sr-only">
        {view === "owner" ? "Owner" : "Tenant"} view. {lines.length} lines. Total{" "}
        {peso.format(total)} pesos.
      </p>

      <table className="w-full border-collapse">
        <caption className="sr-only">
          Statement lines for Unit B-14, September 2026 — {view} view
        </caption>
        <thead>
          <tr>
            <th scope="col" className={`${headCellClasses} text-left`}>
              Line
            </th>
            <th scope="col" className={`${headCellClasses} text-right`}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {/* The owner-only tint is `secondary-container`, the role the selected segment takes, so
              the switch and the rows it adds read as one thing. Text on it stays `on-surface`
              (13.27 light / 6.93 dark) and the sub-meta `on-surface-variant` (7.26 / 5.24) —
              both clear the 4.5 floor in both themes. */}
          {lines.map((line) => (
            <tr key={line.label} className={line.ownerOnly ? "bg-secondary-container" : undefined}>
              <td className={`${cellClasses} text-on-surface`}>
                {line.label}
                <span className="body-s mt-0.5 block text-on-surface-variant">{line.meta}</span>
              </td>
              <td className={`${cellClasses} num text-right text-on-surface`}>
                {peso.format(line.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-4">
        <span className="label-m text-on-surface-variant">
          Due 2026-09-10 · {lines.length} lines
        </span>
        <span className="num headline-s text-on-surface">
          ₱<span>{peso.format(total)}</span>
        </span>
      </div>

      <p className="body-s px-4 pb-4 text-on-surface-variant">
        Tenant view drops dues and assessments — those bill to the owner of record, always.
      </p>
    </div>
  );
}
