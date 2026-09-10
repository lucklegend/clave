# Heartbeat ClaveHQ

Subscription SaaS for Philippine HOA, subdivision and condo management — payment
monitoring, announcements, amenity booking and incident reporting. A Next.js admin
portal for the people doing heavy data entry, and (planned) an Expo app for
residents' daily use.

Turborepo + pnpm workspaces on top of Supabase. There is no hand-rolled API server:
Postgres, Auth, Storage and Realtime are the backend, and every village-scoped table
is filtered by a Row-Level Security policy on `village_id`.

## What works today

- **Landing page** at `/`.
- **Authentication**, end to end. `/sign-in` takes an email _or_ a username plus a
  password, with Remember me and Google OAuth. Google is wired but inert until you
  supply a client ID and secret (see [Configuration](#configuration)).
- **The admin portal shell** — a Material 3 navigation drawer, top bar, and
  `/dashboard` (the Today page) with `/settings` behind it. Drawer rows appear only
  for capabilities you hold; nine of the eleven destinations are visible but
  disabled, because they are the roadmap and have nothing to link to yet.
- **The announcement board** — `/announcements` (table, status filter, pager),
  `/announcements/new` and `/announcements/[id]/edit`, gated on
  `announcements.create`. Drafts, publish-now and scheduled posts, plus attachment
  uploads through the repo's first Storage bucket: private, signed URLs only,
  magic-byte and OOXML-macro inspection, image re-encode with EXIF stripped, and a
  ClamAV scan that fails closed when unconfigured.

Not built: `apps/mobile`, and everything from the payments queue onward. The
announcement branch has had **no code review and no security review** — see
[docs/HANDOFF.md](docs/HANDOFF.md).

## Prerequisites

| Tool           | Version                                                      |
| -------------- | ------------------------------------------------------------ |
| Node.js        | `>=20` per `engines`; the reference environment runs v24.5.0 |
| pnpm           | 11.25.0 (pinned by `packageManager`)                         |
| Docker Desktop | Required — runs the Supabase stack and the ClamAV scanner    |

The Supabase CLI is a repo dev dependency, not a global install. Invoke it as
`pnpm supabase <cmd>`.

## Setup

```bash
pnpm install                  # at the repo root
pnpm supabase start           # local Postgres/Auth/Storage (Docker must be running)
pnpm supabase db reset        # applies supabase/migrations/, then supabase/seed.sql
docker compose up -d          # ClamAV, for attachment uploads
cp apps/web/.env.example apps/web/.env.local
cp .env.example .env
pnpm --filter web dev         # http://localhost:3000
```

Fill `apps/web/.env.local` from what `pnpm supabase status` prints. Full sequence,
ports and machine specs in [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

`supabase/seed.sql` creates a development account on every `db reset`, so there is
nothing to register: **`alpha_admin` / `clavehq-test-1`** (HOA Admin of Villa Alpha).
The password is in version control on purpose — the account exists only in a local
stack.

### Configuration

Two files hold credentials and are both gitignored; each has a tracked
`.env.example` beside it explaining every key.

- **`apps/web/.env.local`** — the Supabase URL and anon key (compiled into the
  browser bundle by design; RLS, not secrecy, is what enforces access), the
  service-role key, and `ANTIVIRUS_SCAN_URL`.
- **`.env` at the repo root** — `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
  `..._SECRET`, read by the Supabase CLI rather than by the web app. The redirect URI
  to register in Google Cloud Console is Supabase's own callback,
  `http://127.0.0.1:54321/auth/v1/callback` — not Next's port 3000. Until these are
  set, everything works except the Google button.

A fresh clone cannot upload an attachment without a scanner. Either run
`docker compose up -d` with `ANTIVIRUS_SCAN_URL` set, or put
`ALLOW_UNSCANNED_UPLOADS=1` in `apps/web/.env.local` for local work — it applies only
when the scan URL is empty, and is ignored outright under `NODE_ENV=production`.

## Scripts

Run from the root to fan out across the workspace via Turborepo, or per package with
`--filter`.

| Root                     | Single package                    | What it does                        |
| ------------------------ | --------------------------------- | ----------------------------------- |
| `pnpm dev`               | `pnpm --filter web dev`           | Next.js dev server on `:3000`       |
| `pnpm build`             | `pnpm --filter web build`         | Production build                    |
| `pnpm lint`              | `pnpm --filter web lint`          | ESLint                              |
| `pnpm typecheck`         | `pnpm --filter web typecheck`     | `next typegen && tsc --noEmit`      |
| `pnpm check:theme`       | `pnpm --filter @clavehq/shared …` | Material 3 token and utility audit  |
| `pnpm check:permissions` | `pnpm --filter @clavehq/shared …` | Permission keys match the catalogue |
| `pnpm format`            | —                                 | Prettier over the repo              |

Supabase, from the root:

```bash
pnpm supabase start | stop | status
pnpm supabase db reset
pnpm supabase gen types typescript --local > packages/shared/src/types/database.ts
```

Regenerate those types after **any** migration change. The file is committed so
`typecheck` runs without Docker.

There is no test runner in the repo yet, so there is no single-test command to give.
Replace this paragraph with the real invocation once Vitest lands.

## Layout

```
apps/
  web/                Next.js 16 App Router, TypeScript, Tailwind 4.
                      src/features/{announcements,auth,authz,brand,landing,
                      portal,theme,today} — grouped by feature, not file type.
  mobile/             Expo React Native. Planned, not on disk.
packages/
  shared/             @clavehq/shared — Zod schemas, inferred types, generated
                      database types, Material 3 theme tokens.
  config/             @clavehq/config — shared TS, ESLint and Prettier config.
supabase/
  migrations/         Schema and RLS policies, one migration per change.
  seed.sql            Villages, roles, the development account.
docs/
  decisions/          ADRs 0001-0005.
```

## Conventions worth knowing before you write code

Full versions in [docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md) and
[CLAUDE.md](CLAUDE.md); these are the ones that go wrong quietly.

- **RLS is the enforcement.** A new village-scoped table gets its policy in the same
  migration that creates it. Filtering in the client is a convenience on top, never
  the boundary.
- **Ask about permissions, never assemble the joins.**
  `user_has_permission(key, village, user)` for a single guard at a mutation
  boundary; `user_permission_keys(village)` for a whole page's worth of gates in one
  round trip. They are not interchangeable — see
  [ADR 0002](docs/decisions/0002-village-scope-and-authz-seam.md). The TypeScript
  seam onto both is `apps/web/src/features/authz/`.
- **The service-role key has exactly one reader**,
  `apps/web/src/features/auth/server/resolve-identifier.ts`, behind
  `import "server-only"`. It bypasses RLS. A second reader is a decision to widen the
  blast radius, not a convenience — raise it first.
- **No public Storage buckets.** Files are reached through short-lived signed URLs
  that force `Content-Disposition: attachment`, and `storage.objects` needs its own
  policies alongside the table's.
- **A domain shape is defined once**, in `packages/shared`, Zod schema first and the
  type inferred from it. The same shape redefined under `apps/` is a bug.
- **A rejected credential returns one message for every cause.** Distinguishing "no
  such user" from "wrong password" makes the form an enumeration oracle.
- Conventional Commits, one feature per branch per PR.

## Docs

| File                                            | Read it when                                          |
| ----------------------------------------------- | ----------------------------------------------------- |
| [HANDOFF.md](docs/HANDOFF.md)                   | Starting a session — status, build order, session log |
| [PROJECT_PROPOSAL.md](docs/PROJECT_PROPOSAL.md) | A change turns on roles, tiers or MVP scope           |
| [TECH_STACK.md](docs/TECH_STACK.md)             | Scaffolding or adding a dependency                    |
| [CODE_STANDARDS.md](docs/CODE_STANDARDS.md)     | Writing code the conventions above don't cover        |
| [FRONTEND.md](docs/FRONTEND.md)                 | Touching the design system or a component             |
| [LOCAL_SETUP.md](docs/LOCAL_SETUP.md)           | Setting up, or a local command fails                  |
| [decisions/](docs/decisions/)                   | You want to know why something is the way it is       |
