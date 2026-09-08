import { BrandMark } from "@/features/brand/components/BrandMark";
import { filledButton, outlinedButton } from "@/features/brand/cta";
import { Label } from "./Label";

// Concept figures, kept as the artifact has them. No cross-section reuse, so they stay here.
const kpis = [
  { value: "4,820", label: "Units modeled" },
  { value: "9,640", label: "Statements/mo" },
  { value: "D+6", label: "Collection lag" },
  { value: "2×", label: "Meter reads/mo" },
] as const;

// A <div>, not a <section>: it is not a register section, and its <h1> already names the
// document. It is wrapped, along with everything down to the closing block, in <main> in
// page.tsx.
export function Hero() {
  return (
    <div className="border-b border-outline-variant pt-14 pb-16 min-[860px]:pt-20 min-[860px]:pb-24">
      <div className="mx-auto grid max-w-[1180px] gap-11 px-[22px] min-[960px]:grid-cols-[1.05fr_.95fr] min-[960px]:items-center min-[960px]:gap-[52px]">
        <div className="min-w-0">
          {/* An M3 assist chip, which is what retires the old label-plus-hairline pair: the rule
              was only there to give the label a baseline, and a filled chip has its own.
              `text-on-primary-container` is load-bearing rather than decorative — `primary-container`
              is the brand green #8dc63f in *both* themes, and `on-surface` on it measures 1.58 in
              dark, so a chip that falls through to the inherited text colour is illegible there.
              Not a <Label>: that renders `label-m`, and one type utility cannot be overridden by
              another from a `className`. */}
          {/* At `label-l` this line is ~285px and takes a second one below ~460px, which is why the
              chip is `min-h-8` rather than `h-8` and `rounded-s` rather than `rounded-full` — a
              two-line pill stops reading as a chip. M3 draws chips on one line; an overflowing
              page at 320px is the alternative. */}
          <span className="mb-5 flex min-h-8 w-fit items-center rounded-s bg-primary-container px-4 py-1.5 label-l text-on-primary-container">
            For HOAs · condo corps · site developers
          </span>
          {/* The <br> is what keeps line 1 from breaking after "One", so this heading opts out of
              the `text-wrap: balance` the base layer gives every h1. The clamp overrides
              `display-l`'s size and line-height together — 1.12 is display-l's own 64/57 ratio, so
              the top of the clamp is exactly `display-l` and the floor is `display-s`'s 36px;
              family, weight and tracking still come from the utility. At 320px that floor sets
              three lines inside a 276px content box and "village." is the longest unbreakable
              token at ~140px, so nothing here may be given `nowrap` or a min-width. */}
          <h1 className="display-l text-wrap text-[clamp(36px,6.2vw,57px)] leading-[1.12]">
            One ledger for
            <br />
            the whole <span className="text-primary">village</span>.
          </h1>
          <p className="mt-5 max-w-[56ch] body-l text-on-surface-variant">
            claveHQ runs dues, meter-based water and power billing, announcements, maintenance
            tickets, amenity bookings and resident records on a single unit-level record. Every peso
            charged has a reading behind it and a person&apos;s name against it.
          </p>
          <div className="mt-[26px] flex flex-wrap gap-2.5">
            <a className={filledButton} href="#modules">
              See what it runs
            </a>
            <a className={`${outlinedButton} text-primary`} href="#billing">
              See the billing run
            </a>
          </div>
          {/* Containment by tone, not by rules: the four cards step to `surface-container-low` and
              the old 1px grid lines showing through a `gap-px` go with the editorial language. */}
          <div className="mt-[34px] grid grid-cols-2 gap-4 min-[600px]:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-m bg-surface-container-low px-4 py-3.5">
                <span className="block num title-l">{kpi.value}</span>
                {/* No `nowrap`, no min-width: at 320px a card is ~130px wide, so a label such
                    as "Meter reads/mo" is wider than its ~98px content box and wrapping to two
                    lines is the intended degradation. */}
                <Label className="mt-[3px] block">{kpi.label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* The one mark on the page that carries an accessible name: it is the only
            branding in this column. `/sign-in` renders the same component unlabelled. */}
        <BrandMark label="claveHQ — the heartbeat of your community" />
      </div>
    </div>
  );
}
