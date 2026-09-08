import { RegisterSection } from "./RegisterSection";
import { SectionHeading } from "./SectionHeading";

type Step = {
  number: string;
  heading: string;
  body: string;
  out: string;
};

// The artifact's `.pipe`: five steps of a single worked example, Unit B-14's electricity line.
const steps: readonly Step[] = [
  {
    number: "STEP 01",
    heading: "Capture",
    body: "Crew walks the phase with a phone. Reading plus photo, offline-first; the previous value is on screen so a fat-finger is caught at the meter.",
    out: "EM-0114 · 4,182 kWh",
  },
  {
    number: "STEP 02",
    heading: "Validate",
    body: "Consumption is compared against the unit's trailing six-month band. Outside ±40%, the reading is held for a re-walk instead of being billed.",
    out: "236 kWh · band 190–290 ✓",
  },
  {
    number: "STEP 03",
    heading: "Rate",
    body: "The village's own rate table applies — the supply rate the association pays, plus its declared systems-loss share, per unit.",
    out: "236 × ₱11.60 + ₱30.00",
  },
  {
    number: "STEP 04",
    heading: "Post",
    body: "Lines join dues, assessments and any chargeable ticket on one statement. Published to the app and to SMS in the same pass.",
    out: "₱2,767.60 → stmt 2026-09",
  },
  {
    number: "STEP 05",
    heading: "Settle",
    body: "Payment applies oldest-first across the unit's open balance. Receipt numbered on the spot; the window clerk cannot edit a posted line, only reverse it.",
    out: "OR-24118 · D+6 median",
  },
];

// §03: reading to receipt, the five-step billing pipeline. `mt-auto` on each `.out` figure
// bottom-anchors it across the row at min-[760px]: — keep it unconditional, it is inert (not
// wrong) in the 1-up stack below that breakpoint.
export function BillingRun() {
  return (
    <RegisterSection id="billing" headingId="billing-h">
      <SectionHeading
        id="billing-h"
        index="03"
        label="Billing run"
        heading="Reading to receipt, in five moves."
        note="A worked example for Unit B-14's electricity line. The steps are ordered because the run is ordered — nothing posts until the readings for a phase are all in."
      />
      <div className="grid grid-cols-1 gap-4 min-[760px]:grid-cols-5">
        {steps.map((step) => (
          <div
            key={step.number}
            className="flex flex-col gap-2 rounded-m bg-surface-container-low px-4 pt-4 pb-5"
          >
            <span className="label-m text-primary">{step.number}</span>
            <h3 className="title-m text-on-surface">{step.heading}</h3>
            <p className="body-m text-on-surface-variant">{step.body}</p>
            <span className="mt-auto border-t border-outline-variant pt-2.5 num body-m text-on-surface">
              {step.out}
            </span>
          </div>
        ))}
      </div>
    </RegisterSection>
  );
}
