// The artifact's `.btn` — shared by both CTAs below. `-translate-y-px` emits Tailwind v4's
// `translate` property, not `transform`, so the reduced-motion blanket in globals.css (which
// only kills `transition`/`animation`, per the artifact's own `.btn:hover{transform:none}`)
// would not suppress it. `motion-reduce:hover:translate-y-0` resets it explicitly.
const ctaBase =
  "inline-block rounded-[2px] border px-4 py-[10px] font-mono text-xs uppercase tracking-[.06em] no-underline transition-[transform,background] duration-[120ms] ease-[ease] hover:-translate-y-px motion-reduce:hover:translate-y-0";

// D4: a ghost/outline CTA border reads `--muted`, not `--rule-strong` (2.17:1 — fails WCAG
// 1.4.11 for a component boundary).
export function Closing() {
  return (
    <div className="border-b border-rule pb-14 pt-16">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-[26px] px-[22px] min-[860px]:grid-cols-[1.1fr_0.9fr] min-[860px]:items-center min-[860px]:gap-[48px]">
        <div>
          <h2 className="text-[clamp(27px,4vw,42px)] tracking-[-0.035em]">
            The dues are the easy part. The trust is the product.
          </h2>
          <p className="mt-3 max-w-[50ch] text-ink-2">
            {
              "Most association software loses residents at the first unexplained charge. claveHQ's answer is that every line traces back to a reading, a rate and a person — visible to the household that owes it, before they ask."
            }
          </p>
        </div>
        <div className="mt-[26px] flex flex-wrap gap-[10px]">
          <a href="#modules" className={`${ctaBase} border-ink bg-ink text-paper`}>
            Walk the modules
          </a>
          <a
            href="#amenities"
            className={`${ctaBase} border-muted bg-transparent text-ink hover:border-accent hover:text-accent`}
          >
            See the amenity board
          </a>
        </div>
      </div>
    </div>
  );
}
