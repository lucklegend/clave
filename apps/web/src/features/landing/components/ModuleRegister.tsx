import { Label } from "./Label";
import { RegisterSection } from "./RegisterSection";
import { SectionHeading } from "./SectionHeading";

type ModuleRow = {
  name: string;
  code: string;
  description: string;
  writesTo: string;
  cadence: string;
};

// Transcribed verbatim from the reference artifact, lines 392-457.
const modules: readonly ModuleRow[] = [
  {
    name: "Dues & assessments",
    code: "DUE",
    description:
      "Per-unit rates by floor area or share, board-approved assessments with amortization schedules, arrears aging.",
    writesTo: "Statement",
    cadence: "Monthly · day 1",
  },
  {
    name: "Utility billing",
    code: "UTL",
    description:
      "Water and power meters where the village owns the distribution. Tiered rate tables, systems-loss allocation, reading photos.",
    writesTo: "Statement",
    cadence: "Semi-monthly",
  },
  {
    name: "Payments",
    code: "PAY",
    description:
      "Cash at the admin window, bank transfer, e-wallet. Partial payments apply oldest-first; every receipt is numbered and reversible only by reversal entry.",
    writesTo: "Ledger",
    cadence: "Continuous",
  },
  {
    name: "Announcements",
    code: "ANN",
    description:
      "Board notices, water interruptions, road works. Targeted by phase, street or unit type; SMS fallback for households with no app.",
    writesTo: "Feed · SMS",
    cadence: "On publish",
  },
  {
    name: "Maintenance tickets",
    code: "TKT",
    description:
      "Resident-raised or inspection-raised. Assigned to a named crew member, photo on close, chargeable jobs push a line to the statement.",
    writesTo: "Crew queue",
    cadence: "Continuous",
  },
  {
    name: "Amenities",
    code: "AMN",
    description:
      "Clubhouse, courts, pool, function hall. Slot inventory, deposits, blackout dates, one active booking per unit per amenity.",
    writesTo: "Statement",
    cadence: "Rolling 60 d",
  },
  {
    name: "Directory & gate",
    code: "DIR",
    description:
      "Owners, tenants, occupants, vehicles, household help. Guard-side lookup is read-only and logged; the gate log is append-only.",
    writesTo: "Gate log",
    cadence: "Continuous",
  },
];

const thClass =
  "border-b border-rule-strong py-0 pr-3 pb-2 text-left font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted";
const tdClass = "border-b border-rule py-[13px] pr-3 align-top group-hover:bg-surface";

// The artifact's own <h2> reads "Six modules" over these same seven rows. The design (§0.1)
// resolves the contradiction by correcting the numeral rather than dropping DIR, a real module
// with its own write target and cadence, to satisfy the count.
export function ModuleRegister() {
  return (
    <RegisterSection id="modules" headingId="modules-h">
      <SectionHeading
        id="modules-h"
        index="02"
        label="Module register"
        heading="Seven modules, one record per unit."
        note="Nothing here is a separate app with its own resident list. A booking, a ticket and a water reading all hang off the same unit, so the statement writes itself at month end."
      />

      {/* Horizontal scroll is the intended 320px behaviour here (design.md §4.4): the four
          columns' combined min-content is ~472px, wider than a 276px content box, and every
          alternative (breaking .m-name mid-phrase, a second stacked-card layout) is worse. A
          scrollable region with no focusable content is otherwise keyboard-unreachable, hence
          role/aria-label/tabIndex (design.md §7.4, deviation D7).

          `relative`: Tailwind's `sr-only` is `position:absolute`, so the caption below would
          take its containing block from outside a static scroll container, escape the clip and
          add its offset to the *document's* scrollable width. */}
      <div
        role="region"
        aria-label="Module register"
        tabIndex={0}
        className="relative overflow-x-auto"
      >
        <table className="w-full border-collapse text-[13.5px]">
          <caption className="sr-only">claveHQ module register</caption>
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                Module
              </th>
              <th scope="col" className={thClass}>
                What it holds
              </th>
              <th scope="col" className={thClass}>
                Writes to
              </th>
              <th scope="col" className={thClass}>
                Cadence
              </th>
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => (
              <tr key={module.code} className="group">
                <td className={`${tdClass} whitespace-nowrap`}>
                  <span className="font-display text-[15.5px] font-bold tracking-[-0.01em]">
                    {module.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10.5px] tracking-[.08em] text-accent">
                    {module.code}
                  </span>
                </td>
                <td className={`${tdClass} text-ink-2`}>{module.description}</td>
                <td className={`${tdClass} whitespace-nowrap font-mono text-[11.5px] text-muted`}>
                  {module.writesTo}
                </td>
                <td className={`${tdClass} whitespace-nowrap font-mono text-[11.5px] text-muted`}>
                  {module.cadence}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Deviation D9: the artifact gives no signal that this table scrolls. Visible below
          760px, where the module-register scroll starts (design.md §4.8, §4.9); aria-hidden
          because the region's own aria-label already names it for a screen reader. */}
      <Label aria-hidden="true" className="mt-2 block min-[760px]:hidden">
        Scroll table sideways →
      </Label>
    </RegisterSection>
  );
}
