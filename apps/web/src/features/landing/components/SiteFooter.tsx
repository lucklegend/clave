// The artifact's `<footer>` — small wordmark plus the concept-build disclaimer. Renders the
// landmark element itself, as a sibling of `<main>` rather than nested inside it, so it reads as
// the page's contentinfo landmark and not as trailing content of the main one.
export function SiteFooter() {
  return (
    <footer className="bg-surface-container-low pb-11 pt-8">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-baseline gap-4 px-[22px]">
        <span className="title-m mr-auto text-on-surface">
          clave<em className="not-italic text-primary">HQ</em>
        </span>
        <p className="max-w-[62ch] body-m text-on-surface-variant">
          {
            "Concept build. Casa Verde Village, its units, meters, rates and residents are invented for this page — no real association, balance or person is represented here."
          }
        </p>
      </div>
    </footer>
  );
}
