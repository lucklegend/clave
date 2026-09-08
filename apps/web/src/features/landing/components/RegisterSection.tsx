import type { ReactNode } from "react";

export type RegisterSectionProps = {
  /** The fragment an in-page CTA anchors to, e.g. "modules". */
  id: string;
  /** The `<h2>` id `SectionHeading` renders. A <section> with no accessible name is not a
   *  landmark at all, so every register section names itself with one. */
  headingId: string;
  children: ReactNode;
};

// The chrome every `<section>` in the register wears — M3's 80px vertical rhythm at the wide end
// and 56px narrow, and one `outline-variant` divider — plus its `.wrap` container. Five sections
// shared this by copy; they share it by composition instead, so the register cannot drift a rule
// at a time. The divider is `outline-variant` and not `outline` because it is decorative: it
// separates two regions of the same tone and carries no control (D4 rule 1).
//
// `tabIndex={-1}` is what makes the three in-page CTAs work: without it the browser scrolls to
// the section but leaves focus on the link, and the next Tab sends the reader back to the top of
// the page. `:focus-visible` does not fire for fragment navigation, so no ring appears.
//
// `scroll-mt-*` is the other half of the sticky top app bar: without it a fragment jump puts the
// top of this section directly under the band and the first thing the reader wants is the first
// thing hidden. The two values track the two band heights, and under M3 they are computed from
// the band's specified box rather than read off a screenshot — every term of it is a fixed length
// at the browser's default text size, so `Masthead` adds up to exactly 64px at ≥860px, 148px
// below it, and 196px under ~465px where the nav wraps to a second row. Each value is the tallest band its query can meet, so the narrow
// one pays for 196px even though most of its range only needs 148px: an over-generous margin adds
// breathing room while a short one hides content under the band. 860 is the masthead's existing
// breakpoint, not a new one.
//
// The hero, the closing block and the footer are deliberately not register sections and keep
// their own chrome.
export function RegisterSection({ id, headingId, children }: RegisterSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="scroll-mt-[196px] border-b border-outline-variant py-14 min-[860px]:scroll-mt-16 min-[860px]:py-20"
    >
      <div className="mx-auto max-w-[1180px] px-[22px]">{children}</div>
    </section>
  );
}
