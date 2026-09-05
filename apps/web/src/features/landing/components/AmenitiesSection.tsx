import { Label } from "./Label";
import { RuleList, type Rule } from "./RuleList";
import { RegisterSection } from "./RegisterSection";
import { SectionHeading } from "./SectionHeading";

type SlotState = "free" | "held" | "bkd";

type Slot = {
  state: SlotState;
  label: string;
};

type AmenityRow = {
  name: string;
  rate: string;
  slots: readonly Slot[];
};

const timeBands = ["08–11", "11–14", "14–17", "17–20", "20–23"] as const;

// Saturday 2026-09-19, Casa Verde — a static illustration of the slot board, not a live one.
// `bkd` cells carry a unit code; `free` and `held` cells already say their state in words, so
// only `bkd` needs the screen-reader-only "Booked by " prefix (design §7.5).
const amenityRows: readonly AmenityRow[] = [
  {
    name: "Clubhouse",
    rate: "₱200 / h · dep ₱1,000",
    slots: [
      { state: "free", label: "Open" },
      { state: "held", label: "Held" },
      { state: "bkd", label: "B-14" },
      { state: "bkd", label: "B-14" },
      { state: "free", label: "Open" },
    ],
  },
  {
    name: "Function hall",
    rate: "₱450 / h · dep ₱2,500",
    slots: [
      { state: "free", label: "Open" },
      { state: "bkd", label: "A-07" },
      { state: "bkd", label: "A-07" },
      { state: "bkd", label: "A-07" },
      { state: "free", label: "Open" },
    ],
  },
  {
    name: "Basketball court",
    rate: "Free · 1 slot / unit",
    slots: [
      { state: "bkd", label: "C-22" },
      { state: "free", label: "Open" },
      { state: "free", label: "Open" },
      { state: "held", label: "Held" },
      { state: "free", label: "Closed" },
    ],
  },
  {
    name: "Pool",
    rate: "₱80 / head · guests ₱150",
    slots: [
      { state: "free", label: "Open" },
      { state: "free", label: "Open" },
      { state: "bkd", label: "D-03" },
      { state: "free", label: "Open" },
      { state: "free", label: "Closed" },
    ],
  },
];

const bookingRules = [
  {
    heading: "Arrears block bookings",
    body: "A unit two statements behind cannot hold a slot. The rule is a village setting, not a hard-coded policy — some boards turn it off.",
  },
  {
    heading: "Deposits ride the statement",
    body: "No separate payment rail. The deposit posts as a line, refunds post as a credit after the crew's post-use check.",
  },
  {
    heading: "Guards see today only",
    body: "The gate view lists the day's confirmed bookings and expected guest counts. No names beyond the booking unit, no balances.",
  },
  {
    heading: "Blackouts beat everything",
    body: "Board-declared maintenance windows and general assembly dates void open slots and notify affected units automatically.",
  },
] as const satisfies readonly Rule[];

// `.cell` state classes — colour is never the only signal (see the `sr-only` prefix on `bkd`
// below); `free` and `held` cells already spell out their state in the visible label.
const cellStateClasses: Record<SlotState, string> = {
  free: "text-muted",
  held: "text-warn bg-[color-mix(in_srgb,var(--warn)_12%,transparent)]",
  bkd: "bg-brand-green font-semibold text-on-green",
};

const colHeadClasses =
  "border-b border-rule bg-surface px-2 py-2 text-center font-mono text-[10px] font-medium tracking-[.1em] uppercase text-muted";

// §04: the slot board. `.slots` scrolls sideways below its 520px floor (design §4.6) — the
// column set is a time axis and cannot reduce further. The wrapper below it, not `.slots`
// itself, is the `.bk` grid item, so the visible scroll hint stacks under the table both above
// and below 900px; `[&>*]:min-w-0` on the grid (design §4.0) stops the scrollable table from
// forcing the track wide.
//
// The scroll container is `relative` so it is the containing block for its own `sr-only`
// content. Tailwind's `sr-only` is `position:absolute`; against a static container the "Booked
// by " prefixes below resolve against the initial containing block, escape the clip and push the
// *document* 97px wide at 320px — the one thing design §4.0 forbids.
export function AmenitiesSection() {
  return (
    <RegisterSection id="amenities" headingId="amenities-h">
      <SectionHeading
        id="amenities-h"
        index="04"
        label="Amenities"
        heading="Slot inventory, not a request form."
        note="Saturday 2026-09-19, Casa Verde. Held slots are unpaid deposits that expire in 24 hours and release themselves."
      />
      <div className="grid gap-5 [&>*]:min-w-0 min-[900px]:grid-cols-[1.35fr_1fr] min-[900px]:items-start min-[900px]:gap-9">
        <div>
          <div
            role="region"
            aria-label="Amenity slot grid, Saturday 2026-09-19"
            tabIndex={0}
            className="relative overflow-x-auto border border-rule-strong bg-surface-2"
          >
            <table className="w-full min-w-[520px] border-collapse text-[12px]">
              <caption className="sr-only">
                Amenity slot availability, Saturday 2026-09-19, Casa Verde
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={`${colHeadClasses} w-[150px] text-left`}>
                    Amenity
                  </th>
                  {timeBands.map((band) => (
                    <th key={band} scope="col" className={colHeadClasses}>
                      {band}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {amenityRows.map((row) => (
                  <tr key={row.name}>
                    <th
                      scope="row"
                      className="border-b border-r border-rule px-2 py-2 text-left text-[13px] font-medium text-ink"
                    >
                      {row.name}
                      <small className="mt-[1px] block font-mono text-[10px] text-muted">
                        {row.rate}
                      </small>
                    </th>
                    {row.slots.map((slot, i) => (
                      <td
                        key={`${row.name}-${i}`}
                        className="border-b border-r border-rule p-0 last:border-r-0"
                      >
                        <span
                          className={`block px-[6px] py-[11px] text-center font-mono text-[10px] uppercase tracking-[.08em] ${cellStateClasses[slot.state]}`}
                        >
                          {slot.state === "bkd" && <span className="sr-only">Booked by </span>}
                          {slot.label}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Label aria-hidden="true" className="mt-2 block min-[520px]:hidden">
            Scroll table sideways →
          </Label>
        </div>
        <RuleList rules={bookingRules} />
      </div>
    </RegisterSection>
  );
}
