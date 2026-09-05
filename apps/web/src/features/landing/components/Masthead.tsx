// The artifact's `.pill`: a mono microlabel in a hairline box. It tracks at .1em rather than the
// .13em of `.lbl`, so it is written out here instead of going through <Label>. The border stays
// `--rule-strong` — the interactive-border rule only binds on the toggle and the ghost CTA.
const pillClasses =
  "rounded-[2px] border border-rule-strong px-[7px] py-0.5 font-mono text-[10.5px] tracking-[.1em] uppercase text-muted";

// `.mast` — the banner landmark. Both rows wrap: at 320px the brand keeps the left and the two
// pills stack beneath each other on the right.
export function Masthead() {
  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-[18px] px-[22px] py-[11px]">
        <span className="mr-auto font-display text-[19px] font-extrabold tracking-[-0.03em]">
          clave<em className="not-italic text-accent">HQ</em>
        </span>
        <div className="flex flex-wrap gap-4">
          <span className={pillClasses}>Concept build v0.4</span>
          <span className={pillClasses}>Residential ops platform</span>
        </div>
      </div>
    </header>
  );
}
