# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Heartbeat ClaveHQ

Subscription SaaS for Philippine HOA / subdivision / condo management — payment
monitoring, announcements, amenity booking, incident reporting. A web app for
admins and officers doing heavy data entry, a mobile app for residents' daily use.

**Built: the landing page, and authentication end to end.** `apps/web`,
`packages/config`, `packages/shared` and `supabase/` all exist and build. The
landing page serves at `/`, `/sign-in` is a working form (email-or-username +
password, Remember me, Google OAuth), and `/dashboard` is a stub behind a session
guard. `apps/mobile` is still a plan — nothing below describing it is on disk.
The next milestone is the announcement board; see `docs/HANDOFF.md`.

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
  functions for cron reminders and webhooks (not built yet).

`apps/mobile` is the only part of the layout above still unbuilt.

Supabase (Postgres + Auth + Storage + Realtime) is the whole backend — there is no
hand-rolled API server to add an endpoint to. The **web** portal signs in with
email-or-username + password and with Google OAuth; **phone OTP is still the plan
for mobile**, and the schema keeps that path open (`users.email` is nullable,
`phone` is carried, and a CHECK requires one of the two). Payments in the MVP are
receipt screenshots uploaded to Storage and verified by an admin by hand; no
payment gateway is wired up.

## Authorisation

`public.users` is the profile, 1:1 with the Supabase-owned `auth.users` row that
holds credentials. Capabilities are dotted keys in `public.permissions`
(`payments.verify`); roles bundle them through `role_permissions`; people receive
them through `user_roles`, and `user_permissions` carries per-user `allow`/`deny`
overrides.

Ask, never assemble the joins at the call site. `public.user_has_permission(permission,
village, user)` answers one boolean about one key and is right for a single guard at a
mutation boundary. `public.user_permission_keys(village)` answers every key the _caller_
holds in one round trip — no `p_user`, on purpose: a `SECURITY DEFINER` function that
enumerates an arbitrary user's grants and is reachable with the anon key is a bulk
permission-disclosure endpoint, so it only ever answers for `auth.uid()`. Use it to draw a
whole page's worth of gates, such as the portal drawer's eleven destinations, rather than
looping `user_has_permission` once per row. The two diverge on a key that does not exist in
the catalogue — `user_has_permission` returns `true` for a super admin (its super-admin
branch fires before any existence check), `user_permission_keys` returns `false` (it
enumerates `public.permissions`) — so they are not interchangeable; see
`docs/decisions/0002-village-scope-and-authz-seam.md`. In both, a `deny` beats everything,
including super admin; a direct `allow` beats the absence of a role grant; super admin
holds the rest.

The TypeScript seam onto both is `apps/web/src/features/authz/` — pure permission helpers,
`server/queries.ts` for the Supabase reads (`import "server-only"`), and
`server/context.ts`'s `cache()`-wrapped `loadAuthzContext()` for the one-resolve-per-request
that the portal shell, drawer, top bar and page all share.

`village_id` on a _grant_ is the scope of that grant, which is not the same thing as
`users.village_id`, the person's home village. One person can be an owner in village
A and an officer in village B, and that is two rows in `user_roles`. Only
`super_admin` may be granted with a NULL `village_id`; a trigger rejects the rest,
because an unscoped grant silently applies in every village.

The authz helpers are all `SECURITY DEFINER`. That is load-bearing: the RLS policy on
`user_roles` calls a function that reads `user_roles`, and under `SECURITY INVOKER`
that recurses forever.

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
  Auth is the exception already on disk: it runs as server actions under
  `apps/web/src/features/auth/actions/`, because a password must not pass through
  client-side control flow.
- **The service-role key has exactly one reader**,
  `apps/web/src/features/auth/server/resolve-identifier.ts`, behind
  `import "server-only"`. It bypasses RLS entirely. Adding a second reader is a
  decision to widen that blast radius, not a convenience — raise it first.
- A rejected credential returns one message for every cause. Distinguishing "no such
  user" from "wrong password" makes the form an account-enumeration oracle.
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
- `pnpm supabase start` / `pnpm supabase db reset` — the local stack (needs Docker
  Desktop running). The CLI is a repo dev dependency, not a global install.
- `pnpm supabase gen types typescript --local > packages/shared/src/types/database.ts`
  — regenerate after **any** migration change. The file is committed so `typecheck`
  works without Docker.

`pnpm --filter mobile start` does not run yet — `apps/mobile` doesn't exist.

No test runner is installed anywhere in the repo yet, so there is no "run a
single test" command to give. Once Vitest (or equivalent) is added, replace
this paragraph with the real invocation.
