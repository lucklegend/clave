// The artifact's `<footer>` — small wordmark plus the concept-build disclaimer. Renders the
// landmark element itself; §7.1 keeps it a sibling of `<main>`, not nested inside it.
export function SiteFooter() {
  return (
    <footer className="pb-11 pt-[26px]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-baseline gap-4 px-[22px]">
        <span className="mr-auto font-display text-[15px] font-extrabold tracking-[-0.03em]">
          clave<em className="not-italic text-accent">HQ</em>
        </span>
        <p className="max-w-[62ch] font-mono text-[11px] leading-[1.6] text-muted">
          {
            "Concept build. Casa Verde Village, its units, meters, rates and residents are invented for this page — no real association, balance or person is represented here."
          }
        </p>
      </div>
    </footer>
  );
}
