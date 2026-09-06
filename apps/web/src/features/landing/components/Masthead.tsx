import Link from "next/link";
import { ThemeToggle } from "@/features/theme/components/ThemeToggle";

// The nav gets its own class string rather than going through <Label>, for the reason the removed
// pills had one: `Label` is the 10.5px/.13em eyebrow voice, for things that name a section, not
// for things you click. `.1em` is what the pills tracked at, so the band's mono texture is
// unchanged by the swap. The 44px target comes from the padding box, never from the font size.
const navLinkClasses =
  "inline-flex min-h-[44px] items-center px-[7px] font-mono text-[12.5px] tracking-[.1em] " +
  "uppercase text-muted hover:text-ink";

// The ghost CTA of `Hero.tsx:14` at 11px, minus its hover lift: the masthead must not compete with
// the hero's primary CTA one screen below, and the page's whole motion budget is that one lift.
// With no transform end-state left over, the reduced-motion blanket in `globals.css` removes the
// colour transition outright and no `motion-reduce:` companion is wanted. The border is `--muted`,
// never `--rule-strong` — 2.08:1 light / 1.82:1 dark against this `--surface` band, a WCAG 1.4.11
// failure for the boundary of a UI component. The pills got away with it only because a pill is
// inert; everything replacing them is interactive.
const signInClasses =
  "inline-flex min-h-[44px] items-center rounded-[2px] border border-muted bg-transparent px-3 " +
  "font-mono text-[11px] tracking-[.06em] uppercase text-ink transition-colors duration-[120ms] " +
  "ease-[ease] hover:border-accent hover:text-accent";

// Section order, which is also DOM order, visual order and tab order. Every id is set by
// `RegisterSection`, and each target carries `tabIndex={-1}` so focus follows the jump.
// Sentence case in the source and uppercased by CSS, so the accessible name stays "Statement".
const navLinks = [
  { href: "#statement", label: "Statement" },
  { href: "#modules", label: "Modules" },
  { href: "#billing", label: "Billing" },
  { href: "#amenities", label: "Amenities" },
  { href: "#specs", label: "Specs" },
] as const;

// `.mast` — the banner landmark, sticky to the top of the viewport so the nav stays reachable
// once the page has scrolled. `sticky` (not `fixed`) keeps the band in flow, so it still takes
// its own height at the top of the document and nothing needs padding to sit under it, and the
// `bg-surface` fill is opaque so the register scrolls beneath it rather than through it. `z-10`
// because a sticky element with `z-auto` is painted under any later positioned box. The cost is
// that a fragment jump would land its section under the band, which is why `RegisterSection`
// carries the matching `scroll-mt-*`; the two numbers move together.
//
// One wrapping flex row with three clusters in it. At ≥860px they share a line: 70 wordmark + 18
// + 366 nav + 18 + 131 controls = 603px against 816px of content box, and the band measures 67px.
// Below 860 the nav is `w-full`, so it consumes a whole flex line on its own and the `ml-auto` on
// the controls cluster cannot pull that cluster back up beside the wordmark: the band is three
// lines — wordmark / nav / controls — measuring 156.4px. Under ~411px the nav itself wraps to two
// rows, making four stacked rows and a 200.4px band, which is a `flex-wrap` outcome and not a
// second breakpoint. Those three heights are measured, not budgeted, and `RegisterSection`'s
// `scroll-mt-*` is sized against them. 860 is the only declared breakpoint here and it sits on the
// `<nav>` alone; it is already on the page's ledger from `SectionHeading` and `.close-in`.
//
// DOM order is wordmark → nav → controls at every width, so visual order, reading order and focus
// order never disagree. That is why there is no `order-*` and no absolute centring — centring the
// nav for real would need `position:absolute`, which is the mechanism that pushed the document
// 97px past a 320px viewport once already. The nav therefore sits ~31px left of true page centre
// at ≥860, because the controls cluster is wider than the wordmark. That is the accepted price.
// Nothing in this band may be given `nowrap`, a fixed width or `overflow-x:hidden`.
export function Masthead() {
  return (
    <header className="sticky top-0 z-10 border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-[18px] gap-y-2 px-[22px] py-[11px]">
        <span className="mr-auto font-display text-[19px] font-extrabold tracking-[-0.03em]">
          clave<em className="not-italic text-accent">HQ</em>
        </span>
        {/* `min-w-0` and `flex-wrap` together are the safety net: if the ≥860 budget is ever wrong
            under a wide fallback font, the nav degrades by taking a second row inside its `flex-1`
            box rather than by blowing the line out. No `gap-y` — each row is already a 44px
            padding box, and a row gap would only add height where height is scarcest. */}
        <nav
          aria-label="Page sections"
          className="flex w-full flex-wrap items-center gap-x-[6px] min-[860px]:w-auto min-[860px]:min-w-0 min-[860px]:flex-1 min-[860px]:justify-center"
        >
          {navLinks.map((link) => (
            <a key={link.href} className={navLinkClasses} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        {/* `ml-auto` holds the cluster on the trailing edge below 860, where the masthead's
            brand-left / meta-right axis does its work and Sign in stays where a thumb reaches for
            it. At ≥860 the nav's `flex-1` has already taken the free space, so it is a no-op. */}
        <div className="ml-auto flex flex-wrap items-center gap-x-[10px] gap-y-2">
          <ThemeToggle />
          <Link className={signInClasses} href="/sign-in">
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
