// The CTA class strings, in one place at last.
//
// Ticket 0002 deliberately left three copies of these — in `Hero.tsx`, `Masthead.tsx` and the
// `/sign-in` stub — on the grounds that one shared component for two callers costs more than it
// saves. `/sign-in`'s real form brings a fourth and fifth (submit, Google), which is where that
// stops being true.
//
// Class strings and not a `<Cta>` component, because the five callers are three different
// elements: `<a>` for in-page anchors, `<Link>` for routes, `<button>` for form submits. A
// polymorphic component would have to take an `as` prop and would end up asserting its own
// element type back into place; sharing the vocabulary and leaving each call site its own tag
// keeps the markup honest and the types inferred.

// `--rule-strong` is 2.17:1 against `--surface` and fails WCAG 1.4.11 for the boundary of a UI
// component, so every interactive border here is `--muted`. Structural hairlines elsewhere on
// the page keep `--rule-strong`; they are not controls.
const ghostPalette = "border-muted bg-transparent text-ink hover:border-accent hover:text-accent";
const solidPalette = "border-ink bg-ink text-paper hover:border-accent-ink hover:bg-accent-ink";

// The page's entire motion budget: a 1px lift on hover.
//
// The reduced-motion blanket in `globals.css` only kills `transition` and `animation`, so the
// end-state lift is suppressed here too with `motion-reduce:hover:translate-y-0`. The artifact's
// `.btn:hover{transform:none}` companion is not ported: these are utilities with no `.btn` class,
// and Tailwind emits the `translate` property rather than `transform`.
const lift =
  "transition duration-[120ms] ease-[ease] hover:-translate-y-px motion-reduce:hover:translate-y-0";

// No transform end-state to suppress, so the reduced-motion blanket removes the colour
// transition outright and no `motion-reduce:` companion is wanted.
const colorShift = "transition-colors duration-[120ms] ease-[ease]";

const heroBase =
  "inline-block rounded-[2px] border px-4 py-2.5 font-mono text-[12px] tracking-[.06em] uppercase";

/** The hero's primary CTA. One per page — nothing else may compete with it. */
export const heroSolidCta = `${heroBase} ${lift} ${solidPalette}`;

/** The hero's secondary CTA. */
export const heroGhostCta = `${heroBase} ${lift} ${ghostPalette}`;

// 11px and no lift: the masthead sits one screen above the hero's primary CTA and must not
// compete with it. `min-h-[44px]` comes from the padding box, never from the font size — an 11px
// label is a ~17px target otherwise.
const compactBase =
  "inline-flex min-h-[44px] items-center justify-center rounded-[2px] border px-3 " +
  "font-mono text-[11px] tracking-[.06em] uppercase";

/** Masthead "Sign in", and the back link on `/sign-in`. */
export const compactGhostCta = `${compactBase} ${colorShift} ${ghostPalette}`;

/** Form submits on `/sign-in`. Full width, and dimmed while the action is in flight. */
export const formSolidCta =
  `${compactBase} w-full ${colorShift} ${solidPalette} ` +
  "disabled:pointer-events-none disabled:opacity-60";

/** The Google button. Same footprint as the submit above it, one visual step quieter. */
export const formGhostCta =
  `${compactBase} w-full gap-2 ${colorShift} ${ghostPalette} ` +
  "disabled:pointer-events-none disabled:opacity-60";
