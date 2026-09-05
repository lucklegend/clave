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
5. Payments in MVP: screenshot/receipt upload + manual admin verification — **no** live payment gateway yet. PayMongo flagged as the Phase 2 gateway (PH-native, supports GCash/Maya/bank transfer).
6. WhatsApp/Viber reminders: Phase 2 (Twilio for WhatsApp, Viber Business Messages API separately) — both need business approval lead time, don't block MVP on them.
7. Roles: super admin, HOA admin/officer, owner, tenant, maintenance crew, security guard.

## Current Status

- Phase: **Monorepo scaffolded, landing page shipped.** `apps/web` (Next.js) and
  `packages/config` exist and build; the claveHQ landing page serves at `/`.
  `apps/mobile`, `packages/shared` and `supabase/` are not built.
- Next milestone: stand up Supabase (project, schema, RLS) per the build order
  below.

## Suggested Build Order

1. Scaffold monorepo (Turborepo, pnpm, `apps/web`, `apps/mobile`, `packages/shared`)
2. Supabase project + initial schema/migrations (`villages`, `profiles`, `units`, `payments`, `announcements`, `amenities`, `bookings`, `reports`) + RLS policies
3. Auth flow (phone OTP) in both apps
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
