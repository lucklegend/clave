// The CTA class strings, in one place at last.
//
// Ticket 0002 deliberately left three copies of these — in `Hero.tsx`, `Masthead.tsx` and the
// `/sign-in` stub — on the grounds that one shared component for two callers costs more than it
// saves. `/sign-in`'s real form brings a fourth and fifth (submit, Google), which is where that
// stops being true.
//
// Class strings and not a `<Cta>` component, because the callers are three different elements:
// `<a>` for in-page anchors, `<Link>` for routes, `<button>` for form submits. A polymorphic
// component would need an `as` prop, and resolving that prop back to a concrete element ends in a
// type assertion — which this project's TypeScript rules forbid outright. M3 multiplies the
// variants (filled / outlined / text / tonal / icon) but not the elements, so that reasoning only
// gets stronger here. Sharing the vocabulary and leaving each call site its own tag keeps the
// markup honest and the types inferred.

// D4 rule 1: `outline` is the only token permitted for a UI-component boundary, and a button
// border is exactly that. `outline-variant` is for decorative hairlines and dividers only — it
// fails 3:1 by design, which is correct for a divider and wrong for a border.
const outlinedBorder = "border border-outline";

// M3 draws every button in this file at 40px, then reaches the 48px pointer target `m3-target`
// (globals.css) gives it by expanding the hit area 4px above and below rather than by growing the
// box. 48 ≥ 44, so this repo's own floor is still satisfied — the number changed, the reasoning
// that put a floor here at all did not. The icon button below skips it: at 48×48 it is already
// past the floor with no expansion needed.
const base = "inline-flex h-10 items-center justify-center rounded-full label-l m3-target";

// The page's entire motion budget is the 120ms `background-color` transition M3's state layer
// runs on hover and `:active` — `m3-state` (globals.css) for outlined, text and icon buttons,
// composited by hand below for filled ones, whose `currentColor` is already an on-colour and so
// cannot be mixed against transparent the same way. There is no transform end-state left to
// neutralise — the old 1px hover lift is gone — so no `motion-reduce:` companion is wanted;
// `prefers-reduced-motion`'s blanket transition kill already leaves every button in its correct
// static state.
//
// In that hand-composited mix the base colour goes first, for the reason `m3-state` records at
// length: Tailwind wraps every `color-mix()` in an `@supports` gate and builds the fallback from
// the first argument. Reversed, a browser without `color-mix` would paint `on-primary` — white —
// as the hover fill under this button's white label.

/** The primary action wherever there is one — hero, closing block, masthead, sign-in submit. */
export const filledButton =
  `${base} px-6 gap-2 bg-primary text-on-primary ` +
  "transition-[background-color,box-shadow] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] " +
  "hover:bg-[color-mix(in_srgb,var(--md-primary),var(--md-on-primary)_8%)] " +
  "hover:shadow-[var(--md-elev-1)] disabled:opacity-[0.38] disabled:pointer-events-none";

/**
 * The secondary action beside a filled button — hero, closing block, dashboard sign-out,
 * sign-in's Google button. **Carries no label colour**: M3's outlined button is `primary`, but
 * `/sign-in`'s Google button is `on-surface` — a third-party sign-in option reads as one of the
 * form's own controls, not as a second primary action — and a call site cannot override a colour
 * baked in here. Both classes would land on the element, Tailwind emits `.text-primary` after
 * `.text-on-surface`, and the override would silently lose. So every caller states its own —
 * three write `text-primary`, one writes `text-on-surface`, and none of them is guessing.
 */
export const outlinedButton =
  `${base} ${outlinedBorder} px-6 gap-2 m3-state ` +
  "disabled:opacity-[0.38] disabled:pointer-events-none";

/** A quiet action with no boundary — masthead nav links, the sign-in back link. */
export const textButton = `${base} px-3 text-on-surface-variant m3-state`;

// M3's fifth variant, `bg-secondary-container text-on-secondary-container`, is deliberately not
// exported: none of the three built surfaces has a call site for it yet, and an exported string
// nothing uses is dead code the next reader still has to evaluate. Add it back the day a consumer
// exists.

/**
 * A 48×48 control with no visible boundary — the theme toggle, the password reveal. **Carries no
 * radius**, for the same cascade reason as `outlinedButton` above and one more: its two callers
 * want different shapes. The password reveal is a plain `rounded-full`; the theme toggle pins
 * `m3-morph-round`'s 24px so its press can morph to `--md-shape-m` without the spring
 * interpolating through a negative radius (`globals.css` carries the arithmetic). A baked
 * `rounded-full` would win over both — it is emitted after `.m3-morph-round` — so the shape is
 * the caller's to state.
 */
export const iconButton =
  "inline-flex h-12 w-12 items-center justify-center text-on-surface-variant m3-state";
