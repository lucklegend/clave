# Heartbeat ClaveHQ — Front-end Plan

How the two front ends are built, and how one Material 3 token set feeds both. Read
`CODE_STANDARDS.md` first — this file does not repeat its rules, it says how they land in
Next.js and in React Native specifically.

Versions this was written against (2026-09-07): **Next.js 16.3.4, React 19.2.8, Tailwind 4,
Zod 4, pnpm 11, Node ≥20**. `apps/mobile` does not exist yet; §2 is the plan for when it does.

---

## 0. The design system

**Material 3, whole product** — landing page, `/sign-in` and the portal. Proposed 2026-09-07,
published as a canvas for review, **adopted in code 2026-09-08** (ticket `0004`) across the three
surfaces that existed then — `/`, `/sign-in`, the `/dashboard` stub — and the portal shell itself
followed the same day (ticket `0007`): the 360px navigation drawer, top app bar and the Today
dashboard at `/dashboard`, now inheriting the same tokens and components rather than anticipating
them. Adopting M3 replaced the editorial design language's token block in `globals.css` wholesale,
as §4 anticipated; the decision, its SchemeContent-over-TonalSpot reasoning and its
component-level sub-decisions are recorded in `docs/decisions/0001-material-3.md`. The portal's
own decisions — village scope, the capability seam, the grants fix — are recorded separately in
`docs/decisions/0002-village-scope-and-authz-seam.md`.

The colour scheme is **generated, not hand-picked**: `#8dc63f` (the brand green) is run through
Google's Material Color Utilities with the **Content** scheme variant. Content preserves the
seed's chroma, which is why `primaryContainer` comes out as literally `#8dc63f` in both light
and dark. Every other role — 35 of them, five surface-container tones, both schemes — is
derived, and the on-colour pairings carry M3's contrast guarantee.

Typography uses M3's two-font split, filled with the faces already loaded: **Bricolage
Grotesque** is the brand font (display, headline, title), **Instrument Sans** is the plain font
(body, label). **Sometype Mono** is an addition, not an M3 role — M3 has no monospace, and a
portal made of money needs figures that line up.

What this costs, stated plainly: M3 is less dense. A two-line list item is 72px where the
editorial rows were 44px. Bigger targets and real component specs, fewer rows per screen.

---

## 1. Web — `apps/web`

### Server-first, and mean it

React Server Components are the default. `"use client"` is a **leaf** decision: push it to the
smallest component that actually needs state, an effect or an event handler, and never to a
layout or a page. Today the only client components are `SignInForm` and `ThemeToggle`, which is
the right shape — keep it.

**Read on the server.** A Server Component talks to Supabase directly through
`createSupabaseServerClient()`; there is no reason to round-trip a fetch through the browser for
data the server already has a session for. Client-side fetching is for what genuinely changes
after paint.

**Mutate with Server Actions.** Auth already does this (`features/auth/actions/`), for the
reason recorded in `CLAUDE.md`: a password must not pass through client-side control flow. Every
other write — verify a receipt, approve a booking, post an announcement — follows the same
shape. Pair them with React 19's `useActionState` / `useFormStatus`, as `SignInForm` does, so
pending and error states come from the framework rather than from hand-rolled `useState`.

**`revalidatePath` / `revalidateTag` after a write**, not a manual refetch.

### Caching is a multi-tenancy hazard

This is the one Next.js feature that can break the security model. Every row in this database is
scoped by `village_id` and enforced by RLS — but a cache sits **in front of** RLS. A response
cached for one village and served to another is a tenancy breach that the database never sees.

Rules:

- Anything derived from `auth.getUser()` or a village-scoped query is **per-request**. Do not
  wrap it in `"use cache"`, and do not give it a `revalidate`.
- If you adopt Next 16's `cacheComponents` / `"use cache"`, scope it to genuinely public,
  village-independent content — the landing page, marketing copy, the pricing table.
- `cookies()` and `headers()` already opt a segment out of static rendering. Do not "optimise"
  that away.

**The rule applies by name to `apps/web/src/features/authz/`** (ticket `0007`), the seam that
resolves a caller's village and permission set. It memoises with React's `cache()`, never
`unstable_cache` or `"use cache"`, and the distinction is not cosmetic: `cache()` is
per-request and dies with the request, while the other two persist **across** requests, keyed
on their arguments. A permission set resolved for one caller and served to the next request for
the same village and arguments is a cross-tenant escalation RLS never sees, because RLS was
satisfied — for the first caller. The consequence travels one level up too: every route under
`app/(portal)/` has to stay dynamically rendered for as long as village scope is resolved
per-request with no cache key that includes it, so a `"use cache"` or a `revalidate` added to a
portal route later reopens the same hazard at the page level rather than the query level. See
`docs/decisions/0002-village-scope-and-authz-seam.md`.

### Streaming

The dashboard is three independent reads — the work queue, the money figures, the booking
calendar. Give each its own `<Suspense>` boundary with a skeleton rather than blocking the whole
page on the slowest one. Add `loading.tsx` per route segment and `error.tsx` where a failed read
should not take down the shell.

### Routing and files

- App Router only. Route groups for the portal shell: `app/(portal)/layout.tsx` holds the
  navigation drawer and top app bar, so `dashboard/page.tsx` and `settings/page.tsx` inside the
  group inherit it without re-rendering it — a route group contributes nothing to the URL, so
  both keep their flat paths.
- `src/proxy.ts` is the session guard (Next 16's rename of middleware). Keep it thin — it
  redirects, it does not authorise. A page that reads user data still checks for itself, as
  `(portal)/settings/page.tsx` already does.
- **A layout cannot see its own route.** `app/(portal)/layout.tsx` is given `params` and
  `children` and nothing else — confirmed against `.next/types/routes.d.ts` and against what a
  Server Component actually receives under `next start` 16.3.4, which is `host`, `user-agent`,
  `accept` and the `x-forwarded-*` set and no path anywhere. The drawer needs to mark one
  destination `aria-current="page"` and the top bar needs to title the page, so `proxy.ts`
  stamps `x-clavehq-pathname` on every portal request (`features/portal/pathname.ts`) and the
  layout reads it back — display-only, nothing is authorised against it. The rejected
  alternatives: `useSelectedLayoutSegment`, which drags the drawer and the permission set into
  the browser bundle for information the server already has, and a `layout.tsx` per portal
  route, which re-renders the shell on every navigation.
- Route Handlers only where a real HTTP endpoint is required. Today that is exactly one: the
  OAuth callback.
- `next typegen` runs as part of `typecheck`, so typed routes are on — but they type page and
  layout _exports_, not `<Link href>`. `href="/nope"` compiles in this configuration; typed
  routes are not the guarantee against a dead link that they read as. Where that guarantee
  matters, model it explicitly instead — `features/portal/nav/destinations.ts` derives a route
  key map from the pages that actually exist and types every built destination's `href` against
  it, rather than against the ambient `Route` type.
- `robots: { index: false }` on every authenticated route, as `/settings` already sets.

### Client state

Per `CODE_STANDARDS.md`: server data lives in the TanStack Query cache, client state in Zustand,
local UI state in `useState`. **Neither is installed yet** — see §4. When Query goes in, use the
RSC-friendly pattern: prefetch on the server, `dehydrate` into a `<HydrationBoundary>`, and let
the client component `useQuery` the same key. Do not fetch the same data twice.

The portal shell and its authz seam (ticket `0007`) shipped without either, and that is not a
gap to close — a server-rendered app whose mutations go through Server Actions has no server
state to put in a Query cache and no cross-component client state to put in Zustand. The village
and permission set are resolved once per request in `features/authz/server/context.ts` and passed
down as props; the first module that genuinely needs client-side server state (something that
changes after paint, on a page that isn't wholly server-rendered) is still what brings Query and
Zustand in, same as before.

### Icons

Material Symbols is the icon set the M3 canvas draws from, and **`next/font/google` cannot serve
it.** Confirmed against this repo's `next@16.3.4` bundled font manifest — 1,942 families, zero
matching "Material Symbols" — because Google serves icon fonts from a different endpoint than the
one `next/font/google` reads. The portal shell (`features/portal/icons.tsx`) self-hosts instead,
via `next/font/local` with the glyph set subset from Google's 3.9MB variable font down to the
roughly fifteen glyphs the shell actually draws (14KB), addressed by private-use-area codepoint
rather than by ligature name — a `<span>foo</span>`-style ligature renders the literal word until
the font loads, and self-hosting narrows that window without closing it; a codepoint renders
nothing in the gap.

### Styling

Tailwind 4, tokens declared in `globals.css` via `@theme inline` so a utility resolves to a
custom property at runtime rather than baking a literal. That is what lets one class name serve
light and dark, and it is exactly the mechanism the M3 tokens need (§3).

---

## 2. Mobile — `apps/mobile` (not built)

- **Expo, managed workflow**, with **Expo Router** for file-based routing. Same mental model as
  the App Router, so navigation does not become a second thing to learn.
- **New Architecture** (Fabric + TurboModules) on from the start. It is the default in current
  Expo SDKs and retrofitting it later is the painful path.
- **react-native-paper v5** for components — it is a Material 3 implementation, which is the
  whole reason the mobile side is cheap now that §0 is settled. Feed it the generated theme
  (§3) through `PaperProvider`.
- **NativeWind** for layout and spacing, per `CODE_STANDARDS.md` §5. Be deliberate about the
  seam: **Paper owns components, NativeWind owns layout.** Do not restyle a Paper button with
  utility classes — change the theme instead, or the two systems will disagree at every edge.
- **Auth**: `@supabase/supabase-js` with an `expo-secure-store` storage adapter,
  `detectSessionInUrl: false`, and an `AppState` listener driving `startAutoRefresh` /
  `stopAutoRefresh`. Phone OTP is the resident path, as `TECH_STACK.md` records.
- **Receipts**: `expo-image-picker` for the camera roll, `expo-camera` for capture. Downsample
  before upload — a modern phone photo is several MB and the whole point is a legible receipt,
  not a print-quality one.
- **Offline**: TanStack Query with an AsyncStorage persister. Residents check dues on patchy
  connections; a cached statement beats a spinner.
- **Delivery**: EAS Build for binaries, EAS Update for JS-only fixes.

---

## 3. One token set, two apps

The scheme is **generated once, committed, and consumed** — never generated at runtime.

```
packages/shared/src/theme/
├── seed.ts          # the seed colour and scheme variant, and nothing else
├── scheme.json      # generated: 36 roles × light/dark, plus the six tonal palettes
├── css.ts           # scheme.json -> CSS custom properties, for apps/web
└── paper.ts         # scheme.json -> MD3Theme object, for react-native-paper
```

A generator script (`@material/material-color-utilities`, dev dependency, run by hand) rewrites
`scheme.json` when the seed changes. It is committed so neither app needs the dependency at
build time, and so a scheme change shows up as a reviewable diff rather than a surprise.

- **Web** imports the CSS custom properties into `globals.css` and maps them under
  `@theme inline`, so `bg-surface-container` is a Tailwind utility that resolves to
  `var(--md-surface-container)` and follows the theme.
- **Mobile** imports the `MD3Theme` object into `PaperProvider`, and NativeWind reads the same
  values through its own theme config.

Shape and type scales travel the same way: one definition, two emitters.

**Landed 2026-09-08 (ticket `0004`, decision D2 in `docs/decisions/0001-material-3.md`): the
data half only.** `scheme.json` and `gen-scheme.mjs` are committed at
`packages/shared/src/theme/`, alongside a hand-run `check-tokens.mjs` that asserts every
`--md-*` declaration in `globals.css` still matches the scheme and that every contrast pair the
design relies on clears its WCAG floor. `css.ts` and `paper.ts` are not built: Tailwind 4's
`@theme` needs literal CSS at build time, so `css.ts`'s only consumer today would be a human
pasting its output into `globals.css` by hand, and `paper.ts` has no app to feed. Both arrive
with `apps/mobile`, the day either has a real runtime consumer. There is no `package.json`
`exports` entry for the JSON yet, for the same reason.

**The rule:** if a colour appears as a literal hex anywhere outside `scheme.json`, it is a bug.
The one sanctioned exception is the five amenity hues — M3 has no categorical colour role, so
they live beside the scheme with their own derivation and their own validation, and colour never
carries their meaning alone (a filled dot is confirmed, a ring is awaiting approval, and every
list row names its amenity in words).

Stated plainly because it is easy to assume otherwise: **`pnpm --filter web build` is not a
safety net for this rule.** Tailwind 4.3.3 drops an unresolvable utility (a mistyped
`bg-slate-200`, a `text-headline-x` that doesn't exist) silently rather than failing the build —
the class just does not appear in the compiled CSS. `--color-*: initial` and `--radius-*: initial`
in `@theme inline` (`globals.css`) make Tailwind's own palette and radius scale unavailable, which
narrows the blast radius, but `check-tokens.mjs` and a human looking at the page are still the
only things that catch a wrong value; a green build proves nothing about it.

---

## 4. Gaps between this document and the repo

Stated so nobody discovers them mid-feature:

- **TanStack Query and Zustand are documented but not installed.** `CODE_STANDARDS.md` §3 and
  §4 describe a data layer that does not exist yet. The first module that needs client-side
  server-state brings them in — the portal shell and its authz seam (ticket `0007`) did not,
  because a server-rendered app whose writes go through Server Actions had no server state or
  cross-component client state to put in either.
- **No test runner anywhere.** `CODE_STANDARDS.md` §6 names Vitest and Testing Library; neither
  is a dependency. The money paths — payment status changes, booking conflicts, permission
  resolution — are the ones that earn tests first. `features/portal/nav/select.ts`'s
  `visibleDestinations`, the pure function deciding which of the eleven nav destinations a
  caller's permission set reveals, is the first candidate the day a runner lands.
- **`apps/mobile` does not exist.** Everything in §2 is a plan.
- **Settled, and worth restating because it is easy to break by accident: `rounded-l` /
  `rounded-s` resolving to the M3 shape scale is not the theme key winning outright — it depends
  entirely on `--radius-*: initial` clearing the bare `--radius` DEFAULT that Tailwind's own
  side-radius utilities are built from.** The theme key does not win on specificity; without
  `--radius-*: initial` (or with a bare `--radius` re-added), Tailwind emits a second declaration
  that wins by source order instead, giving every `rounded-l` / `rounded-s` in the codebase two
  wrong corners — one side keeps the M3 value, the other two take Tailwind's `0.25rem` default —
  with no failed build to flag it. A call site cannot out-specify the breakage either, since it
  arrives by source order. Recorded as a comment in `globals.css` (`@theme inline`) and in
  decision D2's consequences.
- **`docs/decisions/` has two entries now**, `0001-material-3.md` and, from ticket `0007`,
  `0002-village-scope-and-authz-seam.md` — the latter also records a live vulnerability found
  and closed in the function grants underlying `public.user_has_permission`, and a direct
  contradiction with `CLAUDE.md`'s note that Zustand holds "which village an admin is currently
  viewing": village scope is server-resolved with no cookie and no URL segment, so the portal's
  village switcher renders but cannot yet switch.
