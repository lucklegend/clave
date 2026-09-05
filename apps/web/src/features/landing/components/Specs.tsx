import type { ReactNode } from "react";
import { RegisterSection } from "./RegisterSection";
import { SectionHeading } from "./SectionHeading";

type Spec = {
  term: string;
  description: ReactNode;
};

// The artifact's `.v` inline value spans — short mono figures set inside prose.
function Value({ children }: { children: ReactNode }) {
  return <span className="font-mono font-medium tabular-nums text-accent">{children}</span>;
}

// §05: the six specs a deployment assumes. Verbatim from the artifact's `dl.specs`.
const specs: readonly Spec[] = [
  {
    term: "Tenancy",
    description: (
      <>
        One database per association; <Value>village-scoped</Value> rate tables, roles and blackout
        calendars.
      </>
    ),
  },
  {
    term: "Occupancy model",
    description: (
      <>
        Unit → owner of record → tenant → occupants. A unit can carry <Value>1 owner</Value> and{" "}
        <Value>n</Value> occupants.
      </>
    ),
  },
  {
    term: "Meter capture",
    description: (
      <>
        Offline-first Android; syncs on return to the guardhouse. Photo retained{" "}
        <Value>24 mo</Value>.
      </>
    ),
  },
  {
    term: "Reach",
    description: (
      <>
        App, web, and SMS digest for the roughly <Value>1 in 5</Value> households that never install
        anything.
      </>
    ),
  },
  {
    term: "Audit",
    description:
      "Append-only ledger. Every posted line keeps actor, timestamp and source reading; reversals only, no edits.",
  },
  {
    term: "Handover",
    description: (
      <>
        Developer-run for the first <Value>18–36 mo</Value>, then the elected board inherits the
        same instance and its history.
      </>
    ),
  },
];

export function Specs() {
  return (
    <RegisterSection id="specs" headingId="specs-h">
      <SectionHeading
        id="specs-h"
        index="05"
        label="Shape of it"
        heading="What a deployment assumes."
        note="Sized for a village, not an enterprise. One admin, one or two window clerks, a handful of crew, and a few thousand households who mostly want to know what they owe."
      />
      <dl className="grid grid-cols-1 gap-px border border-rule bg-rule min-[640px]:grid-cols-2 min-[1000px]:grid-cols-3">
        {specs.map((spec) => (
          <div key={spec.term} className="bg-paper px-[15px] py-[14px]">
            <dt className="font-mono text-[10px] uppercase tracking-[.12em] text-muted">
              {spec.term}
            </dt>
            <dd className="mt-[5px] text-[13.5px] text-ink">{spec.description}</dd>
          </div>
        ))}
      </dl>
    </RegisterSection>
  );
}
