# 0009 — Collapsible sidebar and a sticky top bar

**Filed:** 2026-09-08
**Stage:** in_progress — small, fully specified, and designed on the canvas before filing.

## What was asked

> lets just add the hamburger on the side of the claveHQ. and when click the sidebar will close
> then retain the humburger icon and click it to show the sidebar. and if possible we can have a
> nav that is sticky on the top. where the today, search, theme, notification and avatar stick.

## The design

Built and approved on the **Dashboard — Today** artboard of the M3 canvas,
`https://claude.ai/code/artifact/68df7d4c-e1b4-45dc-9054-99b13047d010`. A copy of that artboard's
source is at `.agent-work/0009-collapsible-sidebar-sticky-bar/reference-Main.dc.html` — the canvas
itself is a published artifact and this copy will not follow it if it changes.

Two behaviours:

1. **A 48px hamburger beside the `claveHQ` wordmark** in the drawer header. Click it and the drawer
   collapses to nothing — not to a rail. The hamburger is **retained**: it reappears in the top
   bar's leading slot, so the control that hid the sidebar is what brings it back, in the same
   corner it left from.
2. **The top app bar sticks**, carrying the `<h1>`, search, theme toggle, notifications and the
   account avatar.

## The decision this ticket turns on

**Where the collapse state lives, without pulling the permission set into the browser bundle.**

`NavigationDrawer` is a Server Component and its destination list is filtered by
`visibleDestinations(NAV_DESTINATIONS, permissions)` — the viewer's whole capability set. Making the
drawer a client component to hold a boolean would ship that set to the browser, which is the exact
thing ticket 0007's `S6` refused when it rejected `useSelectedLayoutSegment`.

**Use client wrappers with server children.** A `"use client"` frame owns the state and the styling
that depends on it; the server-rendered content passes straight through as `children` and never
crosses the boundary:

- `ShellProvider` — `"use client"`, holds `closed` and `scrolled`, exposes them by context. Wraps
  the whole portal shell in `app/(portal)/layout.tsx`.
- `DrawerFrame` — `"use client"`, the `<nav>` element whose width, padding and visibility read
  `closed`. `NavigationDrawer` stays a Server Component and renders its wordmark, village pill and
  destination list **inside** it.
- `StickyBar` — `"use client"`, the `<header>` whose sticky positioning and on-scroll tonal step
  read `scrolled`. `TopAppBar` stays a Server Component.
- `SidebarToggle` — `"use client"`, the hamburger button. Rendered twice: once in the drawer header
  and once in the bar, where it only appears while `closed`.

The scroll listener needs client JS regardless, so the boundary is already paid for.

## Two details that are easy to get wrong

**Collapse `visibility`, not just width.** A 0px-wide `<nav>` still holds its eleven destination
buttons in the tab order, so a keyboard user would tab through a sidebar that is not on screen.
`visibility: hidden` removes them; it must go back to `visible` on expand.

**The bar cannot stick without a boundary, and `TopAppBar`'s own comment says why:**

> No elevation and no divider … It does not stick, so nothing scrolls under a bar with no boundary
> to separate it.

That comment is correct and this ticket makes it stale. The bar and the page are both `surface`, so
sticking it alone slides content under an invisible edge. It takes M3's on-scroll step to
`surface-container` plus a 1dp shadow over 200ms, and **only while something is actually
underneath** — at scroll top it looks exactly as it does today. Rewrite that comment to say the new
thing rather than deleting it.

## Out of scope

- **No rail.** The sidebar closes completely; that was the choice.
- **Nothing below `lg`.** The drawer is still `hidden lg:flex` and the canvas's modal drawer and
  bottom bar are still unbuilt — that gap is unchanged by this ticket, and the toggle simply does
  not render where the drawer does not.
- **The village pill keeps no chevron**, search and notifications stay `aria-disabled`, and the
  unread dot stays undrawn. Those are ticket 0007's recorded decisions, not oversights.
- **Payments** — the canvas's `Payments.dc.html` still carries the old shell. Not a code concern
  (that route does not exist); noted so the canvas and the code do not silently diverge.

---

## Delivered — 2026-09-08

Both behaviours, on the portal shell.

### Decisions the diff does not explain

- **The collapse state lives in client frames, not in the drawer.** `NavigationDrawer` stays a
  Server Component; `ShellProvider` holds `closed` and `scrolled`, and `DrawerFrame` / `StickyBar`
  read them for styling only. The drawer's filtered destination list passes through as children and
  never crosses the boundary. **Verified, not assumed**: a grep of all 24 files under
  `apps/web/.next/static/` for twelve capability keys and five destination labels found nothing,
  while the same grep does find `Hide the sidebar` in a client chunk — so the negative is meaningful
  rather than a broken search.
- **`ShellProvider` takes the drawer as an element prop, not as children.** The drawer has to be the
  scroll container's sibling, and an element prop crosses the RSC boundary exactly as children do.
  The alternative was a fifth client file for the column.
- **`visibility` collapses with the width.** A 0px-wide `<nav>` still holds its eleven destination
  buttons in the tab order. Confirmed by dispatching real Tab keys: with the drawer closed, focus
  goes `Show the sidebar → Search → theme → Notifications → account` and wraps, with **zero stops
  inside `#portal-drawer`**.
- **The scroll container moved from the document to the portal's right column.** The bar cannot be
  `sticky` against a scroller it is not inside. The drawer's own `sticky top-0` became redundant and
  went.
- **The bar's boundary is conditional.** It shares `surface` with the page and draws no divider, so
  sticking it alone would slide content under an invisible edge — which is exactly what
  `TopAppBar`'s old comment said, and why it did not stick. It now takes M3's on-scroll step to
  `surface-container` plus `--md-elev-1` over 200ms, and only while something is underneath; at
  scroll top it is pixel-identical to before. That comment was rewritten, not deleted.
- **`max-lg:hidden` on the toggle**, added beyond the ticket. Collapse at desktop width and then
  narrow below `lg` and you had an orphan hamburger with no drawer to open, plus a heading 4px from
  the edge. Written as `max-lg:` rather than `lg:` deliberately: a variant rule is emitted after
  `iconButton`'s unprefixed `inline-flex`, so it wins on source order — the other direction cannot
  rely on that.

### What the ticket did not anticipate

**The icon font is subset, and the `menu` codepoint was not in it.** The shipped woff2 carried
exactly the sixteen glyphs `icons.tsx` used, so a `MenuIcon` alone would have rendered `.notdef` —
a tofu box, with a green build and a passing checker. The fix was done the careful way: the existing
file was first reproduced **byte-for-byte** (md5 `0bf6832a89efb258c93157930f668305`) to recover the
original `pyftsubset` invocation, then re-run with `e5d2` added — 17 glyphs, 14452 → 14688 bytes,
same glyph order. The exact command is now recorded in `fonts.ts`, which already carried the
instruction to re-subset when a codepoint is added.

### Verification

Build, typecheck, lint, `check:theme` (360 → **363** candidates, all classified) and
`check:permissions` all green. Because `check-utilities.mjs` only judges the theme namespaces, the
compiled CSS was read directly to confirm every non-theme class emitted a rule — including the
`@media not all and (min-width:64rem)` block at byte 23574, _after_ `.inline-flex` at 7893, which is
what makes the source-order argument above true rather than hopeful.

Exercised in a real browser against a production build, signed in as `alpha_admin`: open →
`360px / 12px / visible`; closed → `0 / 0 / hidden` with the hamburger in the bar and its padding
tightened to 4px; closed and scrolled → `surface-container` plus the elevation; restored from the
bar → drawer back, hamburger gone from the bar. Below `lg`, no drawer and no orphan hamburger, on a
fresh load and after collapsing at 1440px then narrowing.

Reduced motion was checked by sampling _before_ each transition would have finished — the drawer is
already collapsed at +120ms against a 220ms transition, and the bar already stepped at +60ms against
200ms. Both end states correct with motion off, in both directions, so no `motion-reduce:` companion
is wanted.

### Also fixed

`docs/FRONTEND.md` still described the layout reading a `x-clavehq-pathname` header back from
`proxy.ts`. That was true for part of ticket 0007 and stopped being true within it — the header was
removed once `DestinationLink` and `PageHeading` took over, and the doc was not followed. Corrected,
and extended to record why the client leaves are safe: they receive an `href`, two class strings and
a two-entry title record, never the permission set.

### Not done

**The merge gate did not run** — the repo still has no test runner. This branch adds no pure function
worth a test that 0007 did not already leave on the table.

**Neither review ran.** The branch is **unreviewed**.

**The canvas's `Payments.dc.html` still carries the old shell**, so the design and the code now
differ on that artboard. Not a code concern — `/payments` does not exist — but it will confuse
whoever builds ticket 0006 from the canvas.
