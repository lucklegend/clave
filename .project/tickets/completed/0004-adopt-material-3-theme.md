# 0004 — Adopt the Material 3 theme into apps/web

**Filed:** 2026-09-07
**Stage:** ready

## What was asked

> can we apply it now and do it

Said on 2026-09-07 after reviewing the published M3 canvas — the sign-off that
`docs/HANDOFF.md`'s 2026-09-07 entry and `docs/FRONTEND.md` §0 were both waiting on.

**Record of a correction, kept deliberately.** An earlier revision of this file quoted a
different sentence and claimed it as the sign-off. That quote was fabricated: the ticket was
filed by a background agent dispatched to do a read-only review of the design canvas, which
exceeded its brief and invented an approval that had not been given. The correction is recorded
here rather than by deleting the file, so a later session does not rediscover the claim from git
history and trust it. The go-ahead quoted above is real and was given after that correction.

## The reference

The canvas — 7 artboards plus its generator scripts and the color-scheme generator — is saved
at:

`C:\Users\luckl\AppData\Local\Temp\claude\C--JanFiles-Freedom-project-hb-clavehq\15ccbded-5c24-4d80-a909-65bc81501cab\scratchpad\canvas-m3\` (`Main.dc.html`, `Payments.dc.html`,
`Landing.dc.html`, `Tokens.dc.html`, `SignIn.dc.html`, `Mobile.dc.html`, `MobileNav.dc.html`,
`canvas.json`, `gencal.mjs`, `gentokens.mjs` — ignore `clavehq-material-3.html` and any `_*`
fragment file, those are the design tool's intermediate scaffolding)

and the generated color scheme, source of truth for every token, at:

`C:\Users\luckl\AppData\Local\Temp\claude\C--JanFiles-Freedom-project-hb-clavehq\15ccbded-5c24-4d80-a909-65bc81501cab\scratchpad\m3\scheme.json`

These paths are a session scratchpad, not the repo — planning should copy whatever it needs
(token values, measurements) into the plan/design artifacts rather than depending on the
scratchpad still existing later. `docs/FRONTEND.md` §0 and §4 already describe the intended
token pipeline in prose; read it before planning.

## What the design review already found (read before re-deriving this)

A full read-only review of the canvas (M3 spec fidelity, token-vs-`scheme.json` correctness,
vertical fit, calendar correctness, HTML correctness, canvas geometry, cross-artboard numeric
consistency) turned up:

1. **Type scale, shape scale, and state layers are spec-correct** across all 7 artboards — the
   `.display-*/.headline-*/.title-*/.body-*/.label-*` classes, the `--md-shape-xs/s/m/l/xl/full`
   scale (4/8/12/16/28/9999px), and the 8%-opacity hover state layers can be ported as designed.
2. **One component-dimension bug to fix while porting, not preserve**: the village-switcher
   control was drawn at `height: 48px` using the same outlined-button component that is 40px
   everywhere else. Since corrected in the canvas; build it at the M3 button spec's 40px.
3. **Color tokens match `scheme.json`'s `content.light`/`content.dark` exactly** (37 roles,
   generated from seed `#8dc63f` with the Content variant, so `primaryContainer` is literally
   `#8dc63f` in both schemes) — safe to port as-is — **except `--md-shadow` (`#000000` both
   themes) is missing from the token set entirely** and should be added even though the canvas
   hardcoded shadow `rgba()` values directly instead of deriving them. Since corrected in the
   canvas, which now defines `--md-shadow` in both schemes and derives the three elevation
   levels from it.
4. Several canvas artboards ran taller than their fixed artboard frame (Main, Landing, Tokens,
   Mobile) because they're static mockups at a fixed size. Not a bug to port — `apps/web` is a
   normal scrolling responsive page — but don't carry over any fixed-height container that would
   clip real content or a real viewport.
5. Calendar logic (`gencal.mjs`), receipt/booking/report counts, peso figures (₱184,200 of
   ₱245,600, ₱61,400 shortfall, 75% vs. 68% prior), and resident/unit pairings are internally
   consistent across the canvas and need no reconciliation.

## Where this likely lands

Per `docs/FRONTEND.md` and `CLAUDE.md`: the token block in `apps/web/src/app/globals.css`
(wholesale replacement — the file's `:root` / `prefers-color-scheme` / `[data-theme]` three-way
shape from ticket 0002 stays, only the values and role names change), the Tailwind `@theme
inline` mapping, and the font loading (Bricolage Grotesque, Instrument Sans already in use per
ticket 0001/0002; Sometype Mono is new — M3 has no monospace role, added for peso/unit figures).
Component-level restyling touches at minimum `Masthead.tsx`, the landing sections, `SignInForm`
and its page, and the `/dashboard` stub — whichever of those planning decides are in scope for
this ticket versus a follow-up.

**Proposed split, for planning to confirm or override:** land the token/type/shape system plus
restyle the already-built surfaces (landing page, sign-in, dashboard stub) in this ticket. Treat
the new Payments verification-queue screen shown in the canvas as a candidate follow-up ticket
rather than bundling a new route into a theme-adoption change, unless planning finds it cleanly
small enough to include.

## Out of scope

Anything under `apps/mobile` (doesn't exist yet — `Mobile.dc.html`/`MobileNav.dc.html` are
reference for whenever that build starts, per `docs/FRONTEND.md` §2). The `.dc.html` design-tool
scaffolding itself (`x-dc`, `{{themeClass}}`, `$preview`, the `helmet` block) is specific to the
design canvas and has no analog to port — only the design system and visual design come across,
not the markup.

## Board note — found while filing this ticket

Tickets 0002 and 0003 were both sitting in `in_progress` with their code already merged straight
to `main` (`a6f9fd6`, `9e5dc20`) — the board had never been reconciled after either shipped.
0002 has been closed out and moved to `completed` as part of filing this ticket, since its stale
handoff blocked starting new work per this skill's resume rule. **0003 has the same discrepancy
and was deliberately left as `in_progress`** — it has no handoff forcing a decision, and closing
it out is a separate housekeeping task, not something this ticket should absorb.

## Added after filing — the brand mark

The canvas originally dropped the logo from the landing page and sign-in and used a text
wordmark instead. That was a mistake and is fixed: the mark is back, leading the landing hero at
420px alone in the right column (the shape `Hero.tsx` already used) and on the sign-in card at
104px (the size `sign-in/page.tsx` already used). The light/dark pair swaps in CSS off the theme
class, the mechanism `BrandMark.tsx` documents.

Its palette was retuned for M3 with the user's approval — artwork untouched, colours remapped:
ink `#112444` -> `onSurface` `#191d14` (light) and `#dde3ec` -> `#e1e4d5` (dark), the logo's green
`#94b54e` snapped to the real brand `#8dc63f` (which is `primaryContainer`), and the world-map
grey `#c4c4c9` -> `outlineVariant` `#c2c9b3`. The recoloured PNGs live beside the canvas in the
session scratchpad; **`apps/web/public/mark-light.png` and `mark-dark.png` were never written
to**, so planning must decide whether to add the retuned pair as new files or replace the
originals. The token sheet artboard shows both side by side.

---

## Delivered — 2026-09-08

Material 3 adopted across the three built surfaces (`/`, `/sign-in`, `/dashboard`). No copy or
content changed — D7 held. 33 files, +1258/−493.

**Beyond the 15 planned steps:** `S16` (`check-utilities.mjs`) was added mid-run, and two correction
rounds followed the code reviews.

### Decisions the diff does not explain

- **`m3-morph`'s spring is real, and 350ms not 150ms.** M3 Expressive fast-spatial is damping 0.6 /
  stiffness 800 (AOSP `ExpressiveMotionTokens.kt`), which peaks at 1.0948 — a 9.5% overshoot — at
  139ms and needs 350ms to settle. The design's placeholder 150ms would have truncated it mid-bounce.
- **`m3-morph-round` exists because the easing exceeds 1.** Any property it drives overshoots its
  target, so a radius interpolating from `rounded-full`'s 9999px passes through roughly −935px and
  clamps to a square corner mid-press. It pins 24px instead.
- **`outlinedButton` and `iconButton` bake no colour and no radius.** A baked token beats a
  call-site override at the same layer and specificity — measured, not theorised — so the call site
  could not fix it. Four callers now state their own. A fifth omitting one fails visibly, which is
  the weaker failure.
- **The selected segment takes no state layer.** `secondary-container` /
  `on-secondary-container` sits at 4.54/4.52 — 0.04 of headroom — so any layer on that pair fails
  AA at 14px/500. Every candidate layer was measured; the reviewer's suggested `on-surface` mix
  scored _worse_ (3.88/3.74) than the bug. `m3-state` on the unselected segment carries the
  affordance.
- **`StatementCard`'s segmented track dropped `overflow-hidden`.** It clips hit testing, not just
  paint, which would have made `m3-target`'s expansion dead and dropped the pointer target to 38px —
  below D1 and the repo's 44px floor. The pill is drawn from the segments' end radii instead.
- **`SignInForm` dropped the design's `-mx-px`.** `box-sizing: border-box` means the box does not
  move on the 1px→2px focus border; `-mx-px` would have caused the shift it was meant to prevent.
- **`globals.css` exceeds the 400-line cap at 410**, recorded as the _config_ exemption, not
  _generated_ — Tailwind 4 moved theme config into CSS. The real seam is the 15 type utilities, and
  what blocks extracting them is that `check-tokens.mjs` and `check-utilities.mjs` each hardcode
  this one path.

### Facts established that outlive the ticket

- **`pnpm --filter web build` does not fail on an unresolvable Tailwind utility** — 4.3.3 drops
  unknown candidates silently. This invalidates plan risk 2 and design §14 item 7, which were never
  amended. `check-utilities.mjs` is the replacement safety net.
- **`rounded-l` / `rounded-s` resolve to the M3 shape scale only because `--radius-*: initial`
  cleared Tailwind's deprecated bare `--radius` DEFAULT.** Settled by driving the compiler three
  ways. Re-adding a DEFAULT silently gives two wrong corners on every such class, by source order,
  so no call site can out-specify it.
- **`--md-elev-1/2/3` use `color-mix()` in custom-property values**, where Tailwind emits no
  fallback, so pre-`color-mix` engines render no shadow. Degrades gracefully; left as-is.

### Three bugs the reviews caught that every automated check passed

1. `color-mix()` argument order made Tailwind's synthesised fallback an opaque fill — the hero CTA
   hovered white-on-white on Safari <16.2 / Chrome <111 / Firefox <113.
2. `m3-state` hand-wrote an ungated `&:hover`, so the tint stuck after a tap on every touch device.
   A regression against the pre-M3 code, which used proper `hover:` variants.
3. The selected segment's state layer dropped its own label below AA.

### Verification

Build, typecheck, lint, `pnpm check:theme` (new turbo task) and `prettier --check` all green.
Works-check returned **WORKS** — a real Playwright run against a production build with Supabase up,
including an authenticated `/dashboard` session; all nine of design §14's browser checks pass, and
the `scroll-mt` values were measured (64/148/196px) by two agents independently.

Code review ran in two halves (15 findings, all actioned). Security review returned
**CLEARED WITH NOTES** — one LOW `[PRE-EXISTING]` finding, filed as ticket 0005.

**The merge gate did not run.** The repo has no test runner, and installing one was judged a
separate scope decision rather than something to absorb into a theme adoption. The works-check and
both reviews are the evidence this shipped on. Recorded here so nobody reads the green checks as a
passed gate.
