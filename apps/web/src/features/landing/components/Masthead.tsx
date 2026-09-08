import Link from "next/link";
import { filledButton, textButton } from "@/features/brand/cta";
import { ThemeToggle } from "@/features/theme/components/ThemeToggle";

// Section order, which is also DOM order, visual order and tab order. Every id is set by
// `RegisterSection`, and each target carries `tabIndex={-1}` so focus follows the jump. The
// labels were already sentence case in the source and only uppercased by CSS, so dropping the
// uppercase `.1em` mono pill treatment for M3's plain-font `label-l` moves the look and not one
// accessible name.
const navLinks = [
  { href: "#statement", label: "Statement" },
  { href: "#modules", label: "Modules" },
  { href: "#billing", label: "Billing" },
  { href: "#amenities", label: "Amenities" },
  { href: "#specs", label: "Specs" },
] as const;

// M3's small top app bar, and the banner landmark. `bg-surface-container` is the tone M3 gives a
// bar that content scrolls under, and that tone is the whole separation: the bottom hairline goes,
// because a rule on top of a tonal step is two signals for one boundary. The fill stays opaque so
// the register scrolls beneath the band rather than through it. `sticky` (not `fixed`) keeps the
// band in flow, so it still takes its own height at the top of the document and nothing needs
// padding to sit under it; `z-10` because a sticky element with `z-auto` is painted under any
// later positioned box. The cost is that a fragment jump would land its section under the band,
// which is why `RegisterSection` carries the matching `scroll-mt-*`; the two numbers move
// together.
//
// One wrapping flex row with three clusters in it. The band's height is reached rather than
// declared, and every term of it is a specified pixel — `py-2`, `gap-2`, `title-l`'s 28px line
// box, the nav's 40px buttons and the toggle's 48px box — so these are exact:
//
//   ≥860px   8 + 48 + 8                        = 64px, M3's small top app bar height
//   <860px   8 + 28 + 8 + 40 + 8 + 48 + 8      = 148px, three stacked rows
//   ~<465px  the same with a two-row nav       = 196px, four stacked rows
//
// `min-h-16` states the 64px intent so the band cannot quietly collapse if the toggle ever leaves.
// Below 860 the nav is `w-full`, so it consumes a whole flex line on its own and the `ml-auto` on
// the controls cluster cannot pull that cluster back up beside the wordmark. Under ~465px the nav
// itself wraps to two rows — a `flex-wrap` outcome, not a second breakpoint, and the threshold
// moved out from ~411px because `label-l` buttons are wider than the mono pills they replace. At
// ≥860 the three clusters share a line comfortably: ~88 wordmark + 8 + ~432 nav + 8 + ~150
// controls against 816px of content box. 860 is the only declared breakpoint here and it sits on
// the `<nav>` alone; it is already on the page's ledger from `SectionHeading` and `.close-in`.
//
// DOM order is wordmark → nav → controls at every width, so visual order, reading order and focus
// order never disagree. That is why there is no `order-*` and no absolute centring — centring the
// nav for real would need `position:absolute`, which is the mechanism that pushed the document
// 97px past a 320px viewport once already. The nav therefore sits left of true page centre at
// ≥860, because the controls cluster is wider than the wordmark. That is the accepted price.
// Nothing in this band may be given `nowrap`, a fixed width or `overflow-x:hidden`.
export function Masthead() {
  return (
    <header className="sticky top-0 z-10 bg-surface-container">
      <div className="mx-auto flex min-h-16 max-w-[1180px] flex-wrap items-center gap-2 px-[22px] py-2">
        <span className="title-l">
          clave<em className="not-italic text-primary">HQ</em>
        </span>
        {/* `min-w-0` and `flex-wrap` together are the safety net: if the ≥860 budget is ever wrong
            under a wide fallback font, the nav degrades by taking a second row inside its `flex-1`
            box rather than by blowing the line out. `gap-2` is load-bearing on both axes now:
            `m3-target` expands each 40px link's hit area 4px above and below, and two stacked rows
            with no row gap would hand the reader two overlapping, ambiguous targets. */}
        <nav
          aria-label="Page sections"
          className="flex w-full flex-wrap items-center gap-2 min-[860px]:w-auto min-[860px]:min-w-0 min-[860px]:flex-1 min-[860px]:justify-center"
        >
          {navLinks.map((link) => (
            <a key={link.href} className={textButton} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        {/* `ml-auto` holds the cluster on the trailing edge below 860, where the masthead's
            brand-left / meta-right axis does its work and Sign in stays where a thumb reaches for
            it. At ≥860 the nav's `flex-1` has already taken the free space, so it is a no-op. */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <Link className={filledButton} href="/sign-in">
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
