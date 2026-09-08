# 0005 — Security headers for the credential and sign-out forms

**Filed:** 2026-09-08
**Stage:** for_planning
**Source:** `SEC-1`, the only finding of ticket 0004's security review
(`.agent-work/0004-adopt-material-3-theme/security-review.md`). Classified **LOW** and
**`[PRE-EXISTING]`** — it predates the M3 work and did not block that ticket.

## What was found

The sign-in credential form and the dashboard sign-out form ship with no framing protection. There
is no `frame-ancestors` directive and no `X-Frame-Options` header, so nothing stops the pages being
embedded in a hostile frame.

## The trap — read this before planning

`frame-ancestors` can ship on its own today with no consequence. **The danger is what a planner will
naturally reach for next.**

`apps/web/src/app/layout.tsx` carries a parser-blocking `<head>` script injected via
`dangerouslySetInnerHTML` — the pre-paint theme script from ticket 0002. It is the one XSS surface
in the application and it has **no nonce**. Any `script-src` stricter than `'unsafe-inline'` breaks
it outright.

**It must not be fixed by moving, deferring, or `next/script`-ing that script.** The comment at
`layout.tsx:47-52` explains why each of those is wrong: the script must run parser-blocking in
`<head>` or the page paints the wrong theme first and flashes. The correct order of work is to plumb
a nonce into `layout.tsx` _first_, then tighten `script-src` against it.

Ticket 0004's security review verified the script itself is still safe — `theme-script.ts` emits a
byte-identical string and the `t === "light" || t === "dark"` whitelist runs before `setAttribute`.
One latent hazard it recorded: `JSON.stringify` does not escape `</script>`, and the code is safe
only because the sole interpolant is a module-level literal. That invariant is stated in the file
and must survive any change here.

## Scope to settle in planning

Whether this is `frame-ancestors` alone (small, shippable, no conflict) or the full header set
including a nonce-based CSP (materially larger, touches the theme mechanism). Those are different
tickets and the second one is not a tidy-up of the first.
