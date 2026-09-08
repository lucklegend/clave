# Heartbeat ClaveHQ — Front-end Plan

How the two front ends are built, and how one Material 3 token set feeds both. Read
`CODE_STANDARDS.md` first — this file does not repeat its rules, it says how they land in
Next.js and in React Native specifically.

Versions this was written against (2026-09-07): **Next.js 16.3.4, React 19.2.8, Tailwind 4,
Zod 4, pnpm 11, Node ≥20**. `apps/mobile` does not exist yet; §2 is the plan for when it does.

---

## 0. The design system

**Material 3, whole product** — landing page, `/sign-in` and the portal. Proposed 2026-09-07,
published as a canvas for review, and **adopted in code 2026-09-08** (ticket `0004`) across the
three surfaces that exist today — `/`, `/sign-in`, the `/dashboard` stub. The portal itself is
still not built and inherits the same tokens and components when it lands. Adopting M3 replaced
the editorial design language's token block in `globals.css` wholesale, as §4 anticipated; the
decision, its SchemeContent-over-TonalSpot reasoning and its component-level sub-decisions are
recorded in `docs/decisions/0001-material-3.md`.

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

### Streaming

The dashboard is three independent reads — the work queue, the money figures, the booking
calendar. Give each its own `<Suspense>` boundary with a skeleton rather than blocking the whole
page on the slowest one. Add `loading.tsx` per route segment and `error.tsx` where a failed read
should not take down the shell.

### Routing and files

- App Router only. Route groups for the portal shell: `app/(portal)/layout.tsx` holds the
  navigation drawer and top app bar, so every module page inherits it without re-rendering it.
- `src/proxy.ts` is the session guard (Next 16's rename of middleware). Keep it thin — it
  redirects, it does not authorise. A page that reads user data still checks for itself, as
  `dashboard/page.tsx` already does.
- Route Handlers only where a real HTTP endpoint is required. Today that is exactly one: the
  OAuth callback.
- `next typegen` runs as part of `typecheck`, so typed routes are already on. Use them.
- `robots: { index: false }` on every authenticated route, as the dashboard already sets.

### Client state

Per `CODE_STANDARDS.md`: server data lives in the TanStack Query cache, client state in Zustand,
local UI state in `useState`. **Neither is installed yet** — see §4. When Query goes in, use the
RSC-friendly pattern: prefetch on the server, `dehydrate` into a `<HydrationBoundary>`, and let
the client component `useQuery` the same key. Do not fetch the same data twice.

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
  server-state brings them in.
- **No test runner anywhere.** `CODE_STANDARDS.md` §6 names Vitest and Testing Library; neither
  is a dependency. The money paths — payment status changes, booking conflicts, permission
  resolution — are the ones that earn tests first.
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
- **`docs/decisions/` now has its first entry**, `0001-material-3.md`, per `CODE_STANDARDS.md`
  §11. Nothing else is written up yet.
