import { HeroMark } from "./HeroMark";
import { Label } from "./Label";

// The whole motion budget for the page: a 1px lift on hover.
//
// The reduced-motion blanket in `globals.css` only kills `transition` and `animation`, so the
// end-state lift is suppressed here instead with `motion-reduce:hover:translate-y-0`. The
// artifact's `.btn:hover{transform:none}` companion is not ported: these CTAs are utilities with
// no `.btn` class, and Tailwind emits the `translate` property rather than `transform`.
const ctaClasses =
  "inline-block rounded-[2px] border px-4 py-2.5 font-mono text-[12px] tracking-[.06em] uppercase transition duration-[120ms] ease-[ease] hover:-translate-y-px motion-reduce:hover:translate-y-0";
// `--rule-strong` is 2.17:1 and fails WCAG 1.4.11 for the boundary of a UI component, so the
// ghost CTA's border is `--muted`. Structural hairlines elsewhere keep `--rule-strong`.
const ghostCtaClasses = `${ctaClasses} border-muted bg-transparent text-ink hover:border-accent hover:text-accent`;
const solidCtaClasses = `${ctaClasses} border-ink bg-ink text-paper`;

// Concept figures, kept as the artifact has them. No cross-section reuse, so they stay here.
const kpis = [
  { value: "4,820", label: "Units modeled" },
  { value: "9,640", label: "Statements/mo" },
  { value: "D+6", label: "Collection lag" },
  { value: "2×", label: "Meter reads/mo" },
] as const;

// `.hero`. A <div>, not a <section>: it is not a register section, and its <h1> already names the
// document. S12 wraps it, and everything down to the closing block, in <main>.
export function Hero() {
  return (
    <div className="border-b border-rule pt-14 pb-11">
      <div className="mx-auto grid max-w-[1180px] gap-11 px-[22px] min-[960px]:grid-cols-[1.05fr_.95fr] min-[960px]:items-center min-[960px]:gap-[52px]">
        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-2.5">
            <Label>For HOAs · condo corps · site developers</Label>
            <span className="h-px flex-1 bg-rule-strong" />
          </div>
          {/* The <br> is what keeps line 1 from breaking after "One". At 320px this floors to 38px
              and sets three lines inside a 276px content box; "village." is the longest
              unbreakable token at ~147px, so nothing here may be given `nowrap` or a min-width. */}
          <h1 className="text-[clamp(38px,6.2vw,62px)] font-extrabold tracking-[-0.035em]">
            One ledger for
            <br />
            the whole <span className="text-accent">village</span>.
          </h1>
          <p className="mt-5 max-w-[56ch] text-[16.5px] text-ink-2">
            claveHQ runs dues, meter-based water and power billing, announcements, maintenance
            tickets, amenity bookings and resident records on a single unit-level record. Every peso
            charged has a reading behind it and a person&apos;s name against it.
          </p>
          <div className="mt-[26px] flex flex-wrap gap-2.5">
            <a className={solidCtaClasses} href="#modules">
              See what it runs
            </a>
            <a className={ghostCtaClasses} href="#billing">
              See the billing run
            </a>
          </div>
          {/* 1px grid lines are the container's own background showing through the gap. */}
          <div className="mt-[34px] grid grid-cols-2 gap-px border border-rule bg-rule min-[600px]:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-paper px-[13px] py-3">
                <span className="block font-mono text-[20px] font-semibold tracking-[-0.02em] tabular-nums">
                  {kpi.value}
                </span>
                {/* No `nowrap`, no min-width: at 320px a label such as "Meter reads/mo" is wider
                    than its ~110px cell with a wide fallback mono, and wrapping to two lines is
                    the intended degradation. */}
                <Label className="mt-[3px] block">{kpi.label}</Label>
              </div>
            ))}
          </div>
        </div>

        <HeroMark />
      </div>
    </div>
  );
}
