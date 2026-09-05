# Heartbeat ClaveHQ — Local Environment Requirements

## Required installs

| Tool                              | Purpose                                | Notes                                                                                                                    |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Node.js LTS (v20.x)**           | JS runtime                             | Use `nvm` to manage versions                                                                                             |
| **pnpm**                          | Package manager (monorepo workspaces)  | `npm install -g pnpm`                                                                                                    |
| **Git**                           | Version control                        | —                                                                                                                        |
| **Docker Desktop**                | Runs Supabase locally                  | Supabase's local stack (Postgres, Auth, Storage) runs in containers                                                      |
| **Supabase CLI**                  | Spin up local Supabase, run migrations | `npm install -g supabase`                                                                                                |
| **Expo CLI / EAS CLI**            | Run and build the mobile app           | `npm install -g eas-cli`; Expo CLI runs via `npx expo` per-project                                                       |
| **Android Studio**                | Android emulator + SDK                 | Needed to test the mobile app on Android without a physical device                                                       |
| **Xcode** (Mac only)              | iOS Simulator                          | Only needed if you're on a Mac and want to test iOS locally; otherwise EAS Build + a real device (Expo Go app) covers it |
| **VS Code** (or editor of choice) | Development                            | Recommended extensions: ESLint, Prettier, Tailwind CSS IntelliSense                                                      |

## Current state

Only the web app is scaffolded so far — the landing page at `/` in `apps/web`.
Of the sequence below, only **step 1** and **step 5** run today. Steps 2-4
(`supabase start`, `supabase db reset`, `.env.local`) need the Supabase project
this repo doesn't have yet, and step 6 needs `apps/mobile`, which hasn't been
created. Both wait on their respective milestones; the rest of this doc is the
plan of record for when they land.

## First-time setup sequence

1. Clone the repo, run `pnpm install` at the root.
2. `supabase start` — spins up local Postgres/Auth/Storage in Docker (needs Docker Desktop running).
3. `supabase db reset` (or `supabase migration up`) — applies the SQL migrations in `supabase/migrations/`.
4. Copy `.env.example` → `.env.local` in both `apps/web` and `apps/mobile`, fill in the local Supabase URL/anon key printed by `supabase start`.
5. Web: `pnpm --filter web dev` → runs Next.js on `http://localhost:3000`.
6. Mobile: `pnpm --filter mobile start` → opens Expo dev tools; scan the QR code with the **Expo Go** app on your phone, or press `a`/`i` for an emulator/simulator.

## Ports you'll be using locally

- `3000` — Next.js web app
- `54321` (default) — Supabase local API
- `54323` — Supabase Studio (local DB admin UI in the browser)
- Expo's Metro bundler picks its own port (usually `8081`)

## Minimum machine specs

- 8GB RAM works but 16GB is much more comfortable (Docker + Android emulator + Node + browser all running at once).
- Reasonably free disk space — Android Studio's SDK + emulator images alone can take several GB.

## Testing on a real device (recommended over emulators early on)

Install the **Expo Go** app on your own Android/iPhone and scan the QR code from `pnpm --filter mobile start` — this is the fastest way to see real changes without emulator overhead, and it's how you'll want to test the camera/photo-upload flow for payment receipts anyway (emulator cameras are unreliable).
