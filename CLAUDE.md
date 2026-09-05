# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Heartbeat ClaveHQ

Subscription SaaS for Philippine HOA / subdivision / condo management — payment
monitoring, announcements, amenity booking, incident reporting. A web app for
admins and officers doing heavy data entry, a mobile app for residents' daily use.

**Only the landing page is built.** `apps/web` and `packages/config` exist and
build; the claveHQ landing page serves at `/`. `apps/mobile`, `packages/shared`
and `supabase/` are still plans — nothing below describing them is on disk. The
next milestone is Supabase; see `docs/HANDOFF.md`.

## Reach for the docs

- `docs/HANDOFF.md` — current status, decisions already settled, build order,
  session log. Read it when starting a session, and add a dated entry to its
  Session Log when finishing one.
- `docs/TECH_STACK.md` — every stack choice with its reasoning, the intended repo
  layout, and the starting data model. Read before scaffolding or adding a
  dependency.
- `docs/CODE_STANDARDS.md` — the conventions in full. Read before writing code in
  an area the invariants below do not cover.
- `docs/PROJECT_PROPOSAL.md` — the six user roles, the free/Tier 1 split, MVP
  scope. Read when a change turns on who may do what, or on what a tier includes.
- `docs/LOCAL_SETUP.md` — required tooling, ports, first-run sequence. Read when
  setting up or when a local command fails.

## Architecture

Turborepo + pnpm workspaces:

- `apps/web` — Next.js + TypeScript. Admin/officer portal.
- `apps/mobile` — Expo React Native + TypeScript (managed workflow, EAS Build).
  Residents pay, book and report here.
- `packages/shared` — types, Zod schemas, Supabase API client, env validation.
- `packages/config` — shared ESLint/TS config, referenced by both apps.
- `supabase/migrations` — SQL schema and RLS policies; `supabase/functions` — edge
  functions for cron reminders and webhooks.

`apps/mobile`, `packages/shared` and `supabase/` are still unbuilt — only
`apps/web` and `packages/config` exist on disk today.

Supabase (Postgres + Auth + Storage + Realtime) is the whole backend — there is no
hand-rolled API server to add an endpoint to. Auth is phone OTP, because the users
are phone-first. Payments in the MVP are receipt screenshots uploaded to Storage
and verified by an admin by hand; no payment gateway is wired up.

## Multi-tenancy is the load-bearing constraint

Every table except `villages` carries a `village_id`, and access to it is filtered
by a Postgres Row-Level Security policy on that column. A resident of one village
must not be able to read another village's rows even when the frontend asks for
them, so the filter belongs in the RLS policy; filtering in the client is a
convenience on top and never the enforcement. A new village-scoped table gets its
RLS policy in the same migration that creates it.

## Conventions that go wrong quietly

- A domain shape is defined once in `packages/shared` — Zod schema first, type
  inferred from it — and imported by both apps. The same shape redefined under
  `apps/` is a bug.
- Supabase calls live in functions under `packages/shared/api` and reach
  components through TanStack Query. Server data stays in the Query cache; Zustand
  holds only client state, such as which village an admin is currently viewing.
- Source folders group by feature — `features/payments/{components,hooks,api.ts,
types.ts}` — rather than by file type.
- Tailwind on web, NativeWind on mobile, so one styling vocabulary covers both.
- Conventional Commits, and one feature per branch per PR even solo.

## Commands

The monorepo scaffold covers `apps/web` and `packages/config` only — these are
the scripts that actually exist today (full sequence in `docs/LOCAL_SETUP.md`):

- `pnpm install` — at the repo root.
- `pnpm --filter web dev` — Next.js on `http://localhost:3000`.
- `pnpm --filter web build` — production build.
- `pnpm --filter web lint` — ESLint.
- `pnpm --filter web typecheck` — `next typegen && tsc --noEmit`.
- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm typecheck` — the same tasks
  run across the workspace via `turbo run <task>`.

`supabase start`, `supabase db reset` and `pnpm --filter mobile start` do not
run yet — `supabase/` and `apps/mobile` don't exist.

No test runner is installed anywhere in the repo yet, so there is no "run a
single test" command to give. Once Vitest (or equivalent) is added, replace
this paragraph with the real invocation.
