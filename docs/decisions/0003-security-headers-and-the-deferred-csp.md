# 0003 — Security headers, and why the CSP waits

**Date:** 2026-09-08
**Status:** Accepted
**Ticket:** `0005-security-headers`

## Context

Ticket 0004's security review flagged SEC-1: nothing served by `apps/web` carried framing
protection, so `/sign-in` and the sign-out form could be embedded in a hostile frame. The
question the ticket actually turned on was scope — a bare framing fix, or a fuller
`Content-Security-Policy` while a header response was already being touched. This records why
the answer is the narrow one: four headers, shipped in `apps/web/next.config.ts`, and a
nonce-based CSP deferred to a separate ticket rather than folded in here.

## Decisions

### D1 — four headers, shipped from `apps/web/next.config.ts`, each free on this tree

`next.config.ts`'s `headers()` returns one entry for `source: "/:path*"` — matching `/` as well
as everything under it — carrying these four, quoted here character for character:

| Header                    | Value                             |
| ------------------------- | --------------------------------- |
| `Content-Security-Policy` | `frame-ancestors 'none'`          |
| `X-Frame-Options`         | `DENY`                            |
| `Referrer-Policy`         | `strict-origin-when-cross-origin` |
| `X-Content-Type-Options`  | `nosniff`                         |

Each is free — costs nothing to ship because nothing in the app depends on the behaviour it
removes:

- **`frame-ancestors 'none'` / `X-Frame-Options: DENY`.** A search for `iframe`, `<embed`,
  `<object`, `window.open` and `opener` across `apps/web/src` and `packages/*/src` returns no
  matches. The app never frames itself, never opens a popup, and nothing reads `window.opener`.
  `X-Frame-Options` is older-agent parity for the same guarantee `frame-ancestors` already gives
  agents that understand it.
- **`Referrer-Policy: strict-origin-when-cross-origin`.** Already the modern browser default;
  this pins the behaviour for an agent that defaults looser. The one cross-origin handshake in
  the app, Google OAuth, is a full-page `redirect(data.url)` at
  `apps/web/src/features/auth/actions/sign-in.ts:137` — not a popup, and not a flow that reads
  the referrer.
- **`X-Content-Type-Options: nosniff`.** Every asset Next serves already carries a correct type:
  two PNGs in `apps/web/public/` (`mark-light.png`, `mark-dark.png`), one self-hosted
  `material-symbols-outlined.woff2` under `apps/web/src/app/fonts/`, Tailwind's compiled CSS, and
  the JS chunks. Nothing here relies on the browser sniffing a loose or missing type.

### D2 — the nonce-based CSP is a separate ticket, not a tidy-up of this one

A `script-src` directive needs a nonce to be worth anything, and a nonce cannot reach this site's
prerendered landing page. The evidence:

- `apps/web/.next/prerender-manifest.json` marks route `/` with `"compute": "static"` — it is a
  file on disk, not a per-request render.
- The built `apps/web/.next/server/app/index.html` carries exactly five inline `<script>` tags
  with a body (confirmed by extracting every `<script>…</script>` pair): the theme script at
  `apps/web/src/app/layout.tsx:55`, and four `self.__next_f.push(...)` calls — Next's RSC flight
  data, three of them carrying the serialised page and changing with every content edit.
- A nonce is minted per request, by construction. Next's own nonce support works by having the
  proxy stamp a `Content-Security-Policy` request header that Next reads while **rendering** a
  route; a route that is not rendered per request — `/` is a static file by the manifest above —
  cannot receive one. A nonce-CSP sent for `/` would carry a value that appears in **no** script
  in the HTML actually served, and every one of the five inline scripts would be blocked,
  including the theme script that stamps `data-theme` before first paint
  (`apps/web/src/features/theme/theme-script.ts`). The landing page would paint unhydrated — the
  exact hazard this ticket exists to avoid, arriving through the fix meant to prevent it.
- Hashing does not rescue this: the theme script is a compile-time constant and could be hashed,
  but the three content-bearing flight scripts cannot be — their bodies are not stable across
  edits. And the moment a hash or a nonce is present in `script-src`, `'unsafe-inline'` is
  ignored outright by every browser that implements CSP2 or later, so it is not a fallback either.

The deferred ticket's job is therefore not "add `script-src`" — it is **decide the rendering
strategy of the whole site**: plumb a nonce from `apps/web/src/proxy.ts` through
`apps/web/src/app/layout.tsx` into the theme `<script>`, and re-measure the theme-flash window
ticket 0002 measured, because forcing `/` dynamic changes when `<head>` is produced. It also has
to decide `style-src`: the prerendered `index.html` carries two `style="color:transparent"`
attributes from `next/font`'s font-swap mechanism, so a `style-src` without `'unsafe-inline'` (or
a `style-src-attr` carve-out) breaks font swapping the same way an unplanned `script-src` would
break hydration. That ticket should start in `Content-Security-Policy-Report-Only`, precisely
because a CSP that is wrong here is maximally user-visible — an unhydrated, unstyled landing page
— and report-only mode surfaces that before it ships enforcing.

### D3 — headers deliberately not shipped, and why each waits

- **`Strict-Transport-Security`** — inert in every environment this app runs in today. Browsers
  ignore HSTS delivered over plain HTTP, and `http://localhost:3000` is the only place this app
  runs; no domain is registered yet (`apps/web/src/app/layout.tsx` calls `https://clavehq.com` a
  placeholder in its `metadataBase` comment) and no hosting is chosen. It belongs with the
  deployment ticket, on the edge or CDN, where a `preload` decision can be taken deliberately
  rather than defaulted.
- **`Cross-Origin-Opener-Policy`** — safe today only because the Google OAuth flow is a
  full-page redirect (D1). `supabase-js` also supports a `skipBrowserRedirect` popup flow, and
  mobile work is coming; `same-origin` would break a popup flow silently, in the auth path. Not
  free the way D1's four headers are.
- **`Cross-Origin-Embedder-Policy`, `Cross-Origin-Resource-Policy`** — real breakage risk against
  Supabase Storage receipt images, which ticket 0006 introduces, for no attack this app currently
  faces. Not free.
- **`Permissions-Policy`** — camera and geolocation denials are exactly the kind of line a future
  receipt-capture or amenity-location feature trips over with a console-only error. Cheap to add
  later, and better added by the feature that knows what it needs than guessed here.
- **`X-XSS-Protection`** — obsolete, and in its filtering modes historically harmful. Never add
  it, in this ticket or any later one.

### D4 — headers live in `next.config.ts`, not `apps/web/src/proxy.ts`

`apps/web/src/proxy.ts:110–137`'s matcher deliberately excludes `_next/static`, `_next/image`,
`favicon.ico`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, `apple-app-site-association`, the
`.well-known/` namespace, and every image extension — each exclusion named explicitly, per the
comment there, as "a decision to open a route, not a performance tweak." Header delivery must not
inherit that hole: a static PNG or a `.well-known/` ACME response is exactly the kind of response
that still needs `X-Content-Type-Options` and `frame-ancestors`, and it never reaches `proxy.ts`
at all. `next.config.ts`'s `headers()` applies to every response Next serves, static assets
included, so that is where D1's four headers are configured. This is also the home ticket 0004's
security review named for this fix.

## Consequences and open questions

- The recommended follow-up, **ticket 0010 — nonce-based CSP for the inline theme script**, is
  filed by the orchestrator, not by this ADR. It must be told in writing that adding
  `script-src 'unsafe-inline'` as an interim step is not a partial fix — it is a header that
  reads like a CSP and protects nothing, because `'unsafe-inline'` is exactly the class of value
  CSP exists to rule out.
- Until that ticket lands, `apps/web` ships no `script-src`, `style-src`, `default-src` or
  `connect-src` directive of any kind. `frame-ancestors 'none'` is the entire CSP.
- `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Permissions-Policy` and the two
  `Cross-Origin-*-Policy` headers are each one line to add once the condition that currently
  blocks them changes — a registered domain and chosen host, a popup-free guarantee that still
  holds, a feature that knows what it needs. None of them needs its own ADR; this one is the
  place to check before adding any of them.
