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

// 44px against the artifact's ~23px: WCAG 2.5.8 floors a target at 24px, and this page has to
// work in a phone browser. The track is `overflow-hidden` for its 2px radius, which would clip
// the global `:focus-visible` ring on the outer edges, so these two draw theirs inset.
const toggleClasses =
  "min-h-[44px] cursor-pointer bg-transparent px-3 font-mono text-[10.5px] tracking-[.08em] uppercase text-muted " +
  "focus-visible:[outline-offset:-2px] aria-pressed:bg-ink aria-pressed:text-paper " +
  "aria-[pressed=false]:hover:text-ink aria-[pressed=false]:active:bg-surface";

const headCellClasses =
  "border-b border-rule px-[14px] py-2 font-mono text-[10px] font-medium tracking-[.12em] uppercase text-muted";

const cellClasses = "border-b border-rule px-[14px] py-[9px]";

// The one stateful component on the page. It renders owner-side on the server — the superset of
// both views — so a failed hydration costs the switch and nothing else (design §5.4).
export function StatementCard() {
  const [view, setView] = useState<"owner" | "tenant">("owner");

  const lines = statementLines.filter((line) => view === "owner" || !line.ownerOnly);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <div className="border border-rule-strong bg-surface-2 shadow-[var(--shadow)]">
      <div className="flex items-center gap-[10px] border-b border-rule bg-surface px-[14px] py-[10px]">
        <span className="font-mono text-[11.5px] tracking-[.08em] uppercase text-ink-2">
          Statement · 2026-09
        </span>
        <span className="ml-auto rounded-[2px] border border-current px-[7px] py-[2px] font-mono text-[10px] tracking-[.1em] uppercase text-warn">
          Open
        </span>
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-b border-rule px-[14px] py-3">
        <div>
          <div className="font-display text-[17px] font-bold tracking-[-.02em]">Unit B-14</div>
          <div className="text-[12.5px] text-muted">Casa Verde Village · Phase 2 · 118 m²</div>
        </div>
        {/* Two toggle buttons, not a radiogroup: both are tab stops, Enter and Space activate,
            and focus stays where it was pressed. Border is `--muted`, not `--rule-strong`,
            which is 2.17:1 and fails WCAG 1.4.11 for a component boundary. */}
        <div
          role="group"
          aria-label="Statement view"
          className="flex min-h-[44px] self-center overflow-hidden rounded-[2px] border border-muted"
        >
          <button
            type="button"
            aria-pressed={view === "owner"}
            onClick={() => setView("owner")}
            className={toggleClasses}
          >
            Owner
          </button>
          <button
            type="button"
            aria-pressed={view === "tenant"}
            onClick={() => setView("tenant")}
            className={toggleClasses}
          >
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

      <table className="w-full border-collapse text-[13.5px]">
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
          {lines.map((line) => (
            <tr key={line.label} className={line.ownerOnly ? "bg-accent-soft" : undefined}>
              <td className={cellClasses}>
                {line.label}
                <span className="mt-[2px] block font-mono text-[11px] text-muted">{line.meta}</span>
              </td>
              <td className={`${cellClasses} text-right font-mono tabular-nums`}>
                {peso.format(line.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-baseline justify-between gap-3 px-[14px] py-[13px]">
        <span className="font-mono text-[11px] tracking-[.06em] uppercase text-muted">
          Due 2026-09-10 · {lines.length} lines
        </span>
        <span className="font-mono text-[26px] font-semibold tabular-nums tracking-[-.03em]">
          ₱<span>{peso.format(total)}</span>
        </span>
      </div>

      <p className="px-[14px] pb-[13px] font-mono text-[11.5px] text-muted">
        Tenant view drops dues and assessments — those bill to the owner of record, always.
      </p>
    </div>
  );
}
