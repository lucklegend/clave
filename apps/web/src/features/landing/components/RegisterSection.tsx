import type { ReactNode } from "react";

export type RegisterSectionProps = {
  /** The fragment an in-page CTA anchors to, e.g. "modules". */
  id: string;
  /** The `<h2>` id `SectionHeading` renders. A <section> with no accessible name is not a
   *  landmark at all, so every register section names itself with one. */
  headingId: string;
  children: ReactNode;
};

// The chrome the artifact applies to every `<section>` — `padding:52px 0` and the bottom
// hairline — plus its `.wrap` container. Five sections shared this by copy; they share it by
// composition instead, so the register cannot drift a rule at a time.
//
// `tabIndex={-1}` is what makes the three in-page CTAs work: without it the browser scrolls to
// the section but leaves focus on the link, and the next Tab sends the reader back to the top of
// the page. `:focus-visible` does not fire for fragment navigation, so no ring appears.
//
// `scroll-mt-*` is the other half of the sticky masthead: without it a fragment jump puts the top
// of this section directly under the band and the first thing the reader wants is the first thing
// hidden. The two values track the two band heights, measured in the browser: below 860px the
// masthead is three lines and stands 200.4px tall under ~411px, where the nav wraps to two rows,
// and 156.4px above it; at ≥860px it is one line of 67px. Each value is the tallest band its
// query can meet, rounded up to the next pixel — so the narrow one pays for 200.4px even though
// most of its range only needs 156.4px, because an over-generous margin only adds breathing room
// while a short one hides content under the band. 860 is the masthead's existing breakpoint, not
// a new one.
//
// The hero, the closing block and the footer are deliberately not register sections and keep
// their own chrome.
export function RegisterSection({ id, headingId, children }: RegisterSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="scroll-mt-[201px] border-b border-rule py-[52px] min-[860px]:scroll-mt-[68px]"
    >
      <div className="mx-auto max-w-[1180px] px-[22px]">{children}</div>
    </section>
  );
}
