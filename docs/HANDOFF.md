# HANDOFF.md — Heartbeat ClaveHQ

> Purpose: paste the "Resume prompt" at the bottom of this file into Claude Code (or this chat) at the start of any new session, so it has full context without you re-explaining everything. Update the **Status** and **Log** sections yourself (or ask Claude to) at the end of every session.

## Project Snapshot

- **Name:** Heartbeat ClaveHQ — "The Heartbeat of Your Community"
- **What it is:** Subscription SaaS (web + mobile) for HOA/subdivision/condo management — payment monitoring, announcements, amenity booking, incident reporting.
- **Docs:** `PROJECT_PROPOSAL.md` (what & why), `TECH_STACK.md` (how, with reasoning), `CODE_STANDARDS.md` (conventions), `FRONTEND.md` (design system + Next.js/Expo conventions), `LOCAL_SETUP.md` (environment).

## Key Decisions Made (don't relitigate these without a reason)

1. Mobile: React Native + Expo (managed workflow, EAS Build).
2. Web: Next.js + TypeScript.
3. Monorepo: Turborepo + pnpm workspaces (`apps/web`, `apps/mobile`, `packages/shared`).
4. Backend: Supabase (Postgres + Auth + Storage + Realtime), multi-tenant via `village_id` + Row-Level Security.
   4a. **Web portal signs in with email-or-username + password, and with Google OAuth**
   (0003, 2026-09-06). This supersedes "phone OTP" as the _web_ mechanism. Phone OTP
   remains the planned resident path on mobile and is not foreclosed: `public.users.email`
   is nullable, `phone` is carried, and the `users_contactable` CHECK accepts either.
   4b. The profile table is `public.users`, not `profiles` as the TECH_STACK sketch had it.
5. Payments in MVP: screenshot/receipt upload + manual admin verification — **no** live payment gateway yet. PayMongo flagged as the Phase 2 gateway (PH-native, supports GCash/Maya/bank transfer).
6. WhatsApp/Viber reminders: Phase 2 (Twilio for WhatsApp, Viber Business Messages API separately) — both need business approval lead time, don't block MVP on them.
7. Roles: super admin, HOA admin/officer, owner, tenant, maintenance crew, security guard.

## Current Status

- Phase: **The admin portal shell is live.** `apps/web`, `packages/config`,
  `packages/shared` and `supabase/` all exist and build. `apps/mobile` is still not
  built.
- The local Supabase stack runs (`pnpm supabase start`, Docker required). Three
  migrations create `villages`, `users`, `roles`, `permissions`, `role_permissions`,
  `user_roles`, `user_permissions` with RLS on all seven, the seven system roles, a
  28-entry capability catalogue, and (0007) `public.user_permission_keys` — the
  batch capability lookup the portal shell asks once per render instead of calling
  `public.user_has_permission` once per row.
- `/sign-in` is a real form: email-or-username, password, Remember me, Google OAuth.
  Signing in lands on `/dashboard`, now the **Today** page inside the M3 navigation
  drawer shell — three real sections (work queue, stat tiles, an amenity month
  calendar), each rendering an honest empty state rather than a fixture, because
  `announcements`, `payments`, `billing`, `bookings` and the rest have no tables yet.
  The former dashboard's profile card and sign-out form moved intact to `/settings`.
- **Google sign-in is wired but inert** until a Google Cloud OAuth client ID and
  secret are set in `.env` at the repo root; see `.env.example`. Until then, sign in
  with the seeded development account — `alpha_admin` / `clavehq-test-1` (HOA Admin
  of Villa Alpha), recreated by `supabase/seed.sql` on every `db reset`.
- **Material 3 is adopted** (0004, 2026-09-08) across all three surfaces that existed
  then — `/`, `/sign-in`, the `/dashboard` stub — and the portal shell built on 0007
  (drawer, top bar, Today) inherits the same tokens rather than restyling later; see
  `docs/FRONTEND.md` §0 and `docs/decisions/0001-material-3.md`.
- **A live vulnerability was found and closed while building the portal (0007,
  2026-09-08).** Four `SECURITY DEFINER` authorisation helpers, seeded in 0003, were
  revoked from `anon` but not from `PUBLIC` — Postgres grants `EXECUTE` to `PUBLIC` by
  default, and revoking from a role never removes a `PUBLIC` grant, so `anon` kept
  inheriting it. All four answered over PostgREST with the anon key that ships in the
  browser bundle, with no session; `current_village_ids` handed back a named user's
  village ids outright. Table RLS was unaffected — a control request against `users`
  correctly returned `42501` throughout. Fixed for those four and the new
  `user_permission_keys` alike in `20260908130000_user_permission_keys.sql`; full
  account in `docs/decisions/0002-village-scope-and-authz-seam.md`.
- Known, deliberate gaps in the portal shell: the **village switcher renders but
  cannot switch** — village scope is server-resolved per-request with no cookie and no
  URL segment, so there is nowhere to write a selection to yet; it needs its own
  ticket. There is **no mobile navigation below the `lg` breakpoint** — the drawer is
  `hidden lg:flex` and the canvas's modal drawer and bottom bar are unbuilt. **Ten of
  the eleven nav destinations are `aria-disabled`** — only Today has a page behind it;
  the other ten are the roadmap, visible so the drawer's own design promise ("a row
  only appears if you hold the capability that clears it") stays true, disabled
  because nothing exists to link to yet.
- Next milestone: the announcement board, unchanged — the first vertical slice
  through the whole stack now that auth, authorisation and the shell it renders
  inside of all exist. Ticket 0006 (the payments verification queue) is still filed
  and is now considerably cheaper to build, since it no longer has to ship its own
  chrome — the shell it will render inside of already exists.

## Suggested Build Order

1. ~~Scaffold monorepo~~ — done (`apps/web`, `packages/config`, `packages/shared`; `apps/mobile` still pending)
2. Supabase project + schema/migrations + RLS policies
   - ~~`villages`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permissions`~~ — done (0003)
   - still to build: `units`, `payments`, `announcements`, `amenities`, `bookings`, `reports`
3. Auth flow — ~~web: email-or-username + password, Google OAuth~~ done (0003); mobile: phone OTP, pending `apps/mobile`
4. Announcement board (simplest feature — good first vertical slice through the whole stack)
5. Payment monitoring (upload + admin verification)
6. Amenity booking system
7. Incident/reporting system
8. Guard/maintenance "call" feature
9. Tier gating (free vs. Tier 1 feature flags, 50-user cap enforcement)

## Session Log

_(Add a dated entry each session — 2-3 lines: what changed, what's next, anything you decided/changed from the plan above.)_

- **2026-09-05** — Initial planning session. Produced project proposal, tech stack decision, code standards, and local setup docs (this handoff included). No code yet.
- **2026-09-05** — Scaffolded the Turborepo/pnpm workspace (`apps/web`, `packages/config` only — mobile, shared and Supabase deliberately deferred) and shipped the claveHQ landing page as `/` in `apps/web`. Next: Supabase project and schema.
- **2026-09-06** — Added a masthead nav to the landing page's five sections, a light/dark theme toggle that follows the OS preference until first press and is applied before first paint via localStorage, and a `/sign-in` stub route with no auth logic. Next: Supabase project and schema, unchanged.
- **2026-09-06** — Stood up local Supabase (Docker) and shipped auth end to end: the identity/RBAC schema with RLS on all seven tables, `packages/shared`, and a real `/sign-in` form (email-or-username + password, Remember me, Google OAuth) landing on a `/dashboard` stub. **Changed two settled decisions** — the web portal signs in with password + Google rather than phone OTP, and the profile table is `users` rather than `profiles`; both recorded above. Google needs a client ID/secret in `.env` before its button works. Next: the announcement board.
- **2026-09-07** — Design session, **no code changed**. Designed the admin portal shell (left
  rail + top bar, a "needs you" work queue, an amenity-booking calendar) as a canvas, then
  redesigned the **whole product** — landing, sign-in, portal, mobile — into **Material 3** at
  your request, with the scheme generated from the brand green `#8dc63f` via Material Color
  Utilities (Content variant, so `primaryContainer` is exactly the brand green). Wrote
  `docs/FRONTEND.md` covering the Next.js 16 / React 19 server-first conventions, the Expo plan
  for `apps/mobile`, and the one-token-set-two-apps pipeline. **Pending your sign-off on the M3
  canvas**; adopting it replaces the token block in `globals.css` wholesale. Next: either adopt
  M3 in code, or proceed to the announcement board on the existing tokens.
- **2026-09-08** — Adopted Material 3 in code (0004), on your sign-off the day before. The
  editorial token block in `globals.css` is gone, replaced by the generated `#8dc63f`
  `SchemeContent` scheme (`packages/shared/src/theme/scheme.json`, `gen-scheme.mjs`, and a
  hand-run `check-tokens.mjs` that checks every token against the scheme and every contrast pair
  against its WCAG floor), and all three built surfaces — `/`, `/sign-in`, `/dashboard` — are
  restyled to M3 with no copy or content change. `mark-light.png` / `mark-dark.png` were
  replaced in place with the M3-recoloured artwork rather than added alongside — same artwork,
  remapped palette, `BrandMark.tsx` needs no change. Reconciled this repo's 44px tap-target rule
  with M3's 40px button paint: buttons keep the 40px box and reach a 48px pointer target through
  an expanded hit area, icon buttons are 48×48 outright. The first ADR,
  `docs/decisions/0001-material-3.md`, records the scheme choice and these decisions. The portal
  shell, the payments verification queue and a real (non-stub) dashboard remain unbuilt — this
  ticket restyled what exists, it did not add a screen. Next: the announcement board, unchanged.
- **2026-09-08** — Built the admin portal shell and the Today dashboard (0007): the 360px M3
  navigation drawer, top app bar and village pill, plus a real `/dashboard` (work queue, stat
  tiles, an amenity month calendar, every one an honest empty state, no fixtures) and a
  `/settings` page carrying over the old dashboard's profile card and sign-out form unchanged.
  Along the way, closed the gap open since 0003 — nothing in TypeScript had ever called
  `public.user_has_permission` — by giving the shell a real capability seam
  (`apps/web/src/features/authz/`) and a new batch RPC, `public.user_permission_keys`, so
  drawing one page's worth of nav gates costs one round trip instead of fifteen. **Found and
  closed a live vulnerability while doing it**: four authorisation helpers from 0003 were
  revoked from `anon` but not from `PUBLIC`, so `anon` inherited `EXECUTE` anyway and answered
  unauthenticated over PostgREST — `current_village_ids` handed back a named user's village ids
  outright. Fixed in a new migration; table RLS was never affected. `apps/web/src/proxy.ts`
  inverted from an allow-list of protected paths to deny-by-default, so a route nobody
  remembered to guard is now unreachable rather than open. Full account, including the tension
  this creates with `CLAUDE.md`'s note that Zustand holds the currently-viewed village (it
  doesn't — village scope is server-resolved, so the village switcher renders but cannot yet
  switch), in `docs/decisions/0002-village-scope-and-authz-seam.md`. Deliberate, known gaps:
  the village switcher is inert pending its own ticket; there is no mobile navigation below the
  `lg` breakpoint; ten of the eleven nav destinations are `aria-disabled` because only Today has
  a page behind it. Next: the announcement board, unchanged — and ticket 0006 (the payments
  queue) is filed and now considerably cheaper, since it renders inside the shell that now
  exists instead of shipping its own chrome.
- **2026-09-08** — Closed SEC-1 from 0004's security review (0005): `/sign-in`'s credential form
  and `/dashboard`'s sign-out form shipped with no framing protection. `apps/web/next.config.ts`
  now serves four headers on every response — `Content-Security-Policy: frame-ancestors 'none'`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Content-Type-Options: nosniff`. The part worth carrying forward: a nonce-based CSP was
  scoped out on purpose, not overlooked. `/` is prerendered at build time
  (`"compute": "static"` in `apps/web/.next/prerender-manifest.json`) and its built HTML carries
  five inline `<script>` tags, four of them Next RSC flight pushes; a per-request nonce cannot
  reach a file that was already written to disk at build time, so any `script-src` added to this
  CSP would serve the landing page unhydrated. That work is a follow-up ticket and should start
  in report-only mode. Full account, including the free/not-free header table and why HSTS, COOP,
  COEP and `Permissions-Policy` all wait, in
  `docs/decisions/0003-security-headers-and-the-deferred-csp.md`. Next: the announcement board,
  unchanged.

- **2026-09-08** — Ticket 0009: the portal sidebar collapses from a hamburger beside the
  `claveHQ` wordmark, and the top app bar sticks. The hamburger is retained when the sidebar
  closes — it moves to the bar's leading slot, so the control that hid the drawer is what brings
  it back. The bar takes M3's on-scroll tonal step to `surface-container`, and only while content
  is actually underneath: it shares `surface` with the page and draws no divider, so sticking it
  without a conditional boundary would slide content under an invisible edge. The collapse state
  lives in thin `"use client"` frames (`ShellProvider`, `DrawerFrame`, `StickyBar`) so the
  drawer stays a Server Component and the viewer's permission set never reaches the browser —
  proved by grepping the built client chunks, not assumed. Designed on the M3 canvas first
  (`Dashboard — Today`). Next: the announcement board, unchanged.

---

## Resume Prompt (paste this into Claude Code / a new chat to continue)

```
I'm building Heartbeat ClaveHQ, an HOA/subdivision/condo management SaaS
(web + mobile). Read docs/PROJECT_PROPOSAL.md, docs/TECH_STACK.md,
docs/CODE_STANDARDS.md, docs/LOCAL_SETUP.md, and this HANDOFF.md for full
context before doing anything.

Stack: Turborepo + pnpm monorepo, apps/web (Next.js + TS), apps/mobile
(Expo React Native + TS), packages/shared (types/Zod/api client),
Supabase (Postgres + Auth + Storage + Realtime) with village_id-scoped
Row-Level Security for multi-tenancy.

Current status: [UPDATE THIS - e.g. "monorepo scaffolded, working on
Supabase schema" or "announcement board done, starting payment upload"]

What I need this session: [FILL IN]

Follow the conventions in CODE_STANDARDS.md (feature-based folders,
React Query for data fetching, Zod for validation, RLS for every
village-scoped table). Update HANDOFF.md's Session Log when we're done.
```
