# 0001 — Material 3 as the design system, generated from the brand green

**Date:** 2026-09-08
**Status:** Accepted
**Ticket:** `0004-adopt-material-3-theme`

## Context

`apps/web`'s three built surfaces (`/`, `/sign-in`, `/dashboard`) shipped with a hand-tuned
editorial design language — literal hex tokens (`--paper`, `--ink`, `--rule-strong`, `--accent`,
…), a hand-rolled 44px tap-target rule, and no documented contrast guarantee for any pairing.
`docs/FRONTEND.md` §0 had proposed Material 3 for the whole product on 2026-09-07 and published
it as a design canvas for review. The user signed off on adopting it in code on 2026-09-07
("can we apply it now and do it"). `CODE_STANDARDS.md` §11 has asked for an ADR since the file
was written; this is the first one.

## Decision

Adopt **Material 3** as the design language for the whole product, replacing the editorial one
wholesale on the three surfaces that exist today rather than migrating section by section. The
colour scheme is generated from the brand green `#8dc63f` through Google's Material Color
Utilities with the **`SchemeContent`** variant rather than the library's default,
`SchemeTonalSpot`. `TonalSpot` desaturates the seed on the way to a palette; `Content` preserves
its chroma, which is why `primaryContainer` comes out as literally `#8dc63f` in both light and
dark — the brand colour survives being turned into a design system, rather than being
approximated by one. The scheme is generated once and committed
(`packages/shared/src/theme/scheme.json`), never re-derived at build time.

Five further decisions, one sentence each:

- **D1 (tap targets).** M3 paints a button at 40px and reaches its 48dp _touch_ target through an
  expanded hit area rather than a taller box, which does not actually conflict with this repo's
  44px-minimum rule, so buttons keep the 40px paint and gain a 48px pointer target via a
  `::before` (`@utility m3-target`), and icon buttons are 48×48 outright.
- **D2 (the pipeline, data half only).** `scheme.json` and `gen-scheme.mjs` are committed at
  `packages/shared/src/theme/` along with a hand-run `check-tokens.mjs` that polices every hex
  typed into `globals.css` against the scheme and every contrast pair against its WCAG floor, and
  the `css.ts` / `paper.ts` emitters `docs/FRONTEND.md` §3 sketches are deferred to `apps/mobile`,
  since today neither would have a second runtime consumer.
- **D4 (contrast as a role, not a per-component judgment call).** `outline` is the only token
  permitted for a UI-component boundary, `outline-variant` is decorative-only, and the focus ring
  is `primary` globally except on a `primary-container` or `tertiary-container` fill, where a
  `.focus-on-container` scope switches it to `on-primary-container`, because no single ring
  colour clears 3:1 on both the page background and the brand green in both themes.
- **D5 (no `components/ui`).** `cta.ts` stays a class-string module restated in M3 terms
  (`filledButton`, `outlinedButton`, `textButton`, `iconButton`) instead of becoming a
  polymorphic `<Button as={...}>`, because resolving an `as` prop back to a concrete element ends
  in a type assertion, which this project's TypeScript rules forbid outright.
- **D6 (brand marks replaced, not added).** `mark-light.png` / `mark-dark.png` are overwritten
  with the M3-recoloured artwork — identical 420×395 silhouette, only the palette remapped — so
  `BrandMark.tsx` and its theme-driven swap need no change at all, which is the strongest
  argument that replacement rather than addition is correct.

## The fast-spatial spring, and why a radius must never start from `rounded-full`

The one genuinely non-obvious thing this ticket ran into. M3 Expressive's shape and width
transitions (the icon-button press, the segmented-button selection) use a spring, not a standard
easing curve: damping 0.6, stiffness 800, mass 1, taken from AOSP's `ExpressiveMotionTokens.kt`.
Sampled over its 350ms settling time, that spring **peaks at 1.0948 — a 9.5% overshoot — at
139ms**, and CSS has no native spring easing, so `globals.css`'s `m3-morph` utility approximates
it with a 24-point `linear()` curve derived from the same damping/stiffness/mass. Because the
curve exceeds 1, any property it drives overshoots its target on the way there, and a CSS
transition interpolates the _specified_ value of a property, not the one actually painted. A
`border-radius` transition from `rounded-full`'s `9999px` toward `--md-shape-m` therefore doesn't
overshoot slightly past a rounded rectangle — it overshoots through roughly **−935px**, and a
negative radius clamps to a square corner mid-press. That is why `@utility m3-morph-round` exists:
it pins the icon button's resting radius to a literal `24px` (the same painted circle a full round
gives a 48px box, since half of 48 is 24), so the spring's overshoot lands near 10.9px and reads
as the intended bounce instead of a corner snapping square. Any future control that morphs its
shape under this spring inherits the same constraint: start from a finite radius, never from
`9999px`.

## Consequences and open questions

- **`pnpm --filter web build` is not a safety net for a mistyped token or utility.** Tailwind
  4.3.3 drops an unresolvable class silently rather than failing the build. `--color-*: initial`
  and `--radius-*: initial` narrow what a stray class could resolve to, but `check-tokens.mjs` and
  a human looking at the rendered page are what actually catch a wrong value.
- **Settled, and in the dangerous direction: `rounded-l` / `rounded-s` resolving to the M3 shape
  scale is not guaranteed by Tailwind's own resolution order — it depends entirely on
  `--radius-*: initial` clearing the bare `--radius` DEFAULT that Tailwind's side-radius utilities
  are built from.** Compiled three ways to confirm: with `--radius-*: initial` in place, each
  class emits a single rule at the M3 value; without it (or with a bare `--radius` re-added),
  Tailwind emits a _second_ declaration that wins by source order, not specificity — `rounded-l`
  as a second rule on the same selector, `rounded-s` as extra longhands inside the same rule — and
  the result is two wrong corners on every `rounded-l` / `rounded-s` in the codebase (the M3 value
  survives on two corners, `0.25rem` lands on the other two), with no failed build to notice it.
  Recorded as a comment in `globals.css`.
- **Two figures worth not trusting from the design canvas's own token sheet, now that the code is
  the source of truth:** it states `error` on `surface-container-low` at roughly 6.1 (light) /
  10.9 (dark); `check-tokens.mjs` measures **5.84 / 10.08** — both still clear the 4.5 floor, so no
  behavioural consequence, just a stale number. It also draws the theme toggle at `rounded-full`;
  the shipped code pins `m3-morph-round`'s 24px instead, for the overshoot reason above.

## Alternative considered

`SchemeTonalSpot`, M3's default variant, was the other candidate for deriving the scheme. Rejected
because it desaturates the seed on the way to a palette, and having the brand colour cease to be
literally `primaryContainer` was judged a bigger loss than `Content`'s marginally higher-chroma
secondary and tertiary palettes.
