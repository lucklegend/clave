# claveHQ

A Turborepo/pnpm monorepo. Today it contains a single working piece: the claveHQ
landing page, served at `/` by the Next.js app in `apps/web`. The wider platform
(auth, database, mobile app) described in `docs/` is planned but not yet built —
see `docs/HANDOFF.md` and `docs/TECH_STACK.md` for where that stands.

## Prerequisites

- Node.js — `engines` requires `>=20`. The reference environment runs v24.5.0;
  `docs/LOCAL_SETUP.md` still asks for 20.x LTS (see "Current state" note there).
- pnpm — v11.25.0 is what this repo was built and verified against
  (`packageManager` in the root `package.json`).

## Install

```bash
pnpm install
```

Run this at the repo root. It installs all workspace packages, including
`apps/web` and `packages/config`.

## Run

```bash
pnpm --filter web dev
```

Starts the Next.js dev server at `http://localhost:3000`.

Other scripts, run per-package with `--filter web` or across the workspace via
Turborepo from the root:

| Root (turbo)     | `apps/web` equivalent         | What it does                   |
| ---------------- | ----------------------------- | ------------------------------ |
| `pnpm dev`       | `pnpm --filter web dev`       | Next.js dev server on `:3000`  |
| `pnpm build`     | `pnpm --filter web build`     | Production build               |
| `pnpm lint`      | `pnpm --filter web lint`      | ESLint                         |
| `pnpm typecheck` | `pnpm --filter web typecheck` | `next typegen && tsc --noEmit` |

## Workspace layout

This is the scaffold as it exists on disk, not the full platform layout planned
in `docs/TECH_STACK.md`:

```
apps/
  web/              Next.js 16 app (App Router, TypeScript, Tailwind 4 CSS-first
                     config, next/font/google). Ships the landing page at `/`.
packages/
  config/           Shared TypeScript, ESLint and Prettier config, consumed by
                     apps/web as @clavehq/config.
docs/               Planning and process docs (proposal, tech stack, code
                     standards, local setup, handoff log).
```

Not built yet, though referenced elsewhere in the docs: `apps/mobile`,
`packages/shared`, and `supabase/`. There is no auth and no database; the only
routes are `/` and a `/sign-in` stub that holds no auth logic of its own.
