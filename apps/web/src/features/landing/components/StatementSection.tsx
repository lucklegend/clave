import { RuleList, type Rule } from "./RuleList";
import { RegisterSection } from "./RegisterSection";
import { SectionHeading } from "./SectionHeading";
import { StatementCard } from "./StatementCard";

const statementRules = [
  {
    heading: "Owner and tenant see different totals",
    body: "Dues and board assessments follow the owner of record. Switch the view — the tenant copy drops them and retotals, so nobody argues about a charge that was never theirs.",
  },
  {
    heading: "The meter number is on the line",
    body: "WM-0114, 0812 → 0826. A resident who doubts the water bill can walk to their own meter and check the arithmetic against it.",
  },
  {
    heading: "Zero is still a line",
    body: "A late fee of ₱0.00 with the settlement date beside it answers the question before it is asked at the admin window.",
  },
  {
    heading: "One sheet, every module",
    body: "Association dues, village-supplied power and water, a clubhouse booking, a chargeable repair — all posted to the same statement on day one of the month.",
  },
] as const satisfies readonly Rule[];

export function StatementSection() {
  return (
    <RegisterSection id="statement" headingId="statement-h">
      <SectionHeading
        id="statement-h"
        index="01"
        label="The statement"
        heading="Every charge traces back to a reading."
        note="September for a fictional unit in Casa Verde. Dues, both metered utilities, an amenity booking and the late-fee line that says none — one sheet, whatever module the charge came from."
      />
      {/* The card carries the statement's own table, which deliberately has no scroll
          container: a resident on a phone must see the amount beside the line. `min-w-0` on
          both columns keeps a future long word from blowing a track out. */}
      <div className="grid gap-[26px] [&>*]:min-w-0 min-[920px]:grid-cols-[1.12fr_.88fr] min-[920px]:items-start min-[920px]:gap-[38px]">
        <StatementCard />
        <RuleList rules={statementRules} />
      </div>
    </RegisterSection>
  );
}
