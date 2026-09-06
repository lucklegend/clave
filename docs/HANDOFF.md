# HANDOFF.md — Heartbeat ClaveHQ

> Purpose: paste the "Resume prompt" at the bottom of this file into Claude Code (or this chat) at the start of any new session, so it has full context without you re-explaining everything. Update the **Status** and **Log** sections yourself (or ask Claude to) at the end of every session.

## Project Snapshot

- **Name:** Heartbeat ClaveHQ — "The Heartbeat of Your Community"
- **What it is:** Subscription SaaS (web + mobile) for HOA/subdivision/condo management — payment monitoring, announcements, amenity booking, incident reporting.
- **Docs:** `PROJECT_PROPOSAL.md` (what & why), `TECH_STACK.md` (how, with reasoning), `CODE_STANDARDS.md` (conventions), `LOCAL_SETUP.md` (environment).

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

- Phase: **Auth is live.** `apps/web`, `packages/config`, `packages/shared` and
  `supabase/` all exist and build. `apps/mobile` is still not built.
- The local Supabase stack runs (`pnpm supabase start`, Docker required). Two
  migrations create `villages`, `users`, `roles`, `permissions`, `role_permissions`,
  `user_roles`, `user_permissions` with RLS on all seven, plus the seven system roles
  and a 28-entry capability catalogue.
- `/sign-in` is a real form: email-or-username, password, Remember me, Google OAuth.
  `/dashboard` is a stub behind the session guard in `apps/web/src/proxy.ts`.
- **Google sign-in is wired but inert** until a Google Cloud OAuth client ID and
  secret are set in `.env` at the repo root; see `.env.example`. Until then, sign in
  with the seeded development account — `alpha_admin` / `clavehq-test-1` (HOA Admin
  of Villa Alpha), recreated by `supabase/seed.sql` on every `db reset`.
- Next milestone: the announcement board — the first vertical slice through the whole
  stack now that auth and authorisation exist to scope it.

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
