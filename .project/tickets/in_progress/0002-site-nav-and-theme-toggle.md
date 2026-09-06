# 0002 — Site nav and theme toggle

**Filed:** 2026-09-05
**Stage:** for_planning

## What was asked

> Right now it has no menu on the top where as remove the 'concept build v0.4' and
> 'Residental DPS Platform' it should have sign in button and in the center are
> menus like model lets have a theme for dark theme and light theme.

Four changes to the masthead of the landing page shipped by [0001](../completed/0001-landing-page.md):

1. **Remove the two status pills.** `Masthead.tsx` renders "Concept build v0.4" and
   "Residential ops platform" as mono microlabels in hairline boxes. Both go.
2. **Add centre navigation.** The masthead has no nav at all today.
3. **Add a Sign in button**, right-aligned where the pills used to sit.
4. **Add a light/dark theme control.**

## Where it lands

`apps/web/src/features/landing/components/Masthead.tsx` is the whole of the current
masthead — 20 lines, zero-prop, a `<header>` holding the `clave`+`HQ` wordmark and
the two pills, both rows wrapping at 320px. It is the only file guaranteed to change.

The theme work also touches `apps/web/src/app/globals.css` and
`apps/web/src/app/layout.tsx`; see "What already exists" below.

## Settled with the user before filing — 2026-09-05

1. **Centre nav points at in-page section anchors.** Five links to the five sections
   that already carry ids: `#statement`, `#modules`, `#billing`, `#amenities`,
   `#specs` (set by `RegisterSection` in each section component). Every link resolves
   today and no new routing is needed. This matches the two hero CTAs, which already
   anchor to `#modules` and `#billing`. **Not** a marketing nav — Product, Pricing
   and Docs would each be a dead href or a stub route, and that is a different,
   larger ticket.
2. **Sign in gets a stub route.** A real `/sign-in` page with placeholder content, so
   the button behaves like a button and nothing 404s. Auth does not exist yet —
   Supabase is unbuilt and `docs/TECH_STACK.md` plans phone OTP — so the real form
   drops into this route later. No auth logic in this ticket.
3. **The theme control is three-way and remembered.** Light / Dark / System, saved to
   `localStorage`, applied before first paint so there is no flash of the wrong
   theme. System stays the default, which is what the page does today.

## What already exists — do not rebuild it

The 0001 design anticipated this control. `apps/web/src/app/globals.css` already
defines the complete light and dark token sets three times over:

- `:root` — the light palette.
- `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` — the
  system-preference dark palette, written so an explicit light choice wins over it.
- `:root[data-theme="light"]` and `:root[data-theme="dark"]` — the explicit override
  that beats the media query in both directions.

The same three-way shape governs the logo mark swap (`.mark-light` / `.mark-dark`).

So **the CSS contract is already built and the toggle only has to set or clear
`data-theme` on `<html>`**. `layout.tsx` deliberately sets no `data-theme` today, and
its own comment says the attribute is an override hook. Redefining tokens, adding a
`dark:` variant strategy, or introducing a theme library would all be rework.

`@theme inline` in `globals.css` is load-bearing: it makes Tailwind utilities resolve
through `var()` at runtime rather than freezing the light value at build time. Dark
mode dies silently without it.

## What planning has to settle

1. **Pre-paint application without a flash.** Next.js App Router renders this page on
   the server, and `localStorage` is not readable there. Decide the mechanism — the
   usual answer is a small blocking inline script in `<head>` that reads storage and
   stamps `data-theme` before the body paints. Weigh it against the project rule in
   `CLAUDE.md` that Zustand holds client state; a masthead toggle may not earn a
   store, and the store would not solve the pre-paint problem anyway.
2. **Where the client boundary goes.** The page is entirely server components today.
   The toggle needs `"use client"`; decide whether that is the toggle alone or the
   whole masthead, and keep the boundary as small as it can be.
3. **The nav at 320px.** This is the ticket's real design problem. The masthead
   currently fits a wordmark and two pills by wrapping. It must now fit a wordmark,
   five nav links, a Sign in button and a theme control, and 0001's hard contract is
   that the page works down to a 320px viewport with no horizontal overflow.
   `overflow-x:hidden` on `body` is prohibited as a fix (0001 defect 2). Decide the
   small-screen form: a disclosure menu, a scrolling nav strip, or dropping the
   centre links below a breakpoint.
4. **Whether the nav marks the current section.** Scroll-spy is a real feature with
   real cost; a plain anchor list is not. Default to the plain list unless the design
   argues otherwise.
5. **The theme control's form and labels.** It has three states, so it is not a
   binary switch. Decide between a segmented control and a cycling button, and settle
   the accessible name for each state — icon-only controls need one.
6. **The stub sign-in page's shape.** Route location, whether it reuses the masthead
   and footer, and what it says. Keep it minimal.

## Constraints carried from 0001

- **320px, no horizontal overflow.** Confirmed by the user as the mobile contract.
- **Interactive borders do not use `--rule-strong`** (2.17:1, fails WCAG AA). The
  Sign in button and the theme control are interactive; the hero's two CTAs are the
  precedent to follow, and `design.md` §10 carries the measurements.
- **Tap targets on interactive controls are 44px.** 0001 raised the statement view
  toggle from ~23px for exactly this reason.
- The page honours `prefers-reduced-motion`; any nav or toggle transition must too.

## Out of scope

Real authentication, Supabase, any other route beyond the sign-in stub, and any
change to the five section bodies. The centre nav links to the sections; it does not
touch them.
