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
// The hero, the closing block and the footer are deliberately not register sections and keep
// their own chrome.
export function RegisterSection({ id, headingId, children }: RegisterSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="border-b border-rule py-[52px]"
    >
      <div className="mx-auto max-w-[1180px] px-[22px]">{children}</div>
    </section>
  );
}
