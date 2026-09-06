# Heartbeat ClaveHQ — Local Environment Requirements

## Required installs

| Tool                              | Purpose                                | Notes                                                                                                                     |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Node.js LTS (v20.x)**           | JS runtime                             | Use `nvm` to manage versions                                                                                              |
| **pnpm**                          | Package manager (monorepo workspaces)  | `npm install -g pnpm`                                                                                                     |
| **Git**                           | Version control                        | —                                                                                                                         |
| **Docker Desktop**                | Runs Supabase locally                  | Supabase's local stack (Postgres, Auth, Storage) runs in containers                                                       |
| **Supabase CLI**                  | Spin up local Supabase, run migrations | Installed as a repo dev dependency — `pnpm install` brings it. Invoke as `pnpm supabase <cmd>`; no global install needed. |
| **Expo CLI / EAS CLI**            | Run and build the mobile app           | `npm install -g eas-cli`; Expo CLI runs via `npx expo` per-project                                                        |
| **Android Studio**                | Android emulator + SDK                 | Needed to test the mobile app on Android without a physical device                                                        |
| **Xcode** (Mac only)              | iOS Simulator                          | Only needed if you're on a Mac and want to test iOS locally; otherwise EAS Build + a real device (Expo Go app) covers it  |
| **VS Code** (or editor of choice) | Development                            | Recommended extensions: ESLint, Prettier, Tailwind CSS IntelliSense                                                       |

## Current state

Steps 1-5 below all run today. Only **step 6** does not — `apps/mobile` has not
been created yet.

Two things need your own credentials and are not in the repo:

- **`apps/web/.env.local`** — copy from `apps/web/.env.example`, fill in from
  `pnpm supabase status`.
- **`.env` at the repo root** — copy from `.env.example`. Holds the Google OAuth
  client ID and secret, read by the Supabase CLI (not by the web app). Until they
  are set, everything works except the "Continue with Google" button. The
  authorized redirect URI to register in Google Cloud Console is
  `http://127.0.0.1:54321/auth/v1/callback` — Supabase's port, **not** Next's 3000.

## First-time setup sequence

1. Clone the repo, run `pnpm install` at the root.
2. `pnpm supabase start` — spins up local Postgres/Auth/Storage in Docker (needs Docker Desktop running).
3. `pnpm supabase db reset` — applies the migrations in `supabase/migrations/`, then `supabase/seed.sql`.
4. Copy `apps/web/.env.example` → `apps/web/.env.local` and fill in the URL, anon key and service-role key printed by `pnpm supabase status`. Copy `.env.example` → `.env` at the root for the Google OAuth values.
   - `supabase/seed.sql` creates a development account, so there is nothing to set up before you can sign in:

     |          |                          |
     | -------- | ------------------------ |
     | Username | `alpha_admin`            |
     | Email    | `admin@villa-alpha.test` |
     | Password | `clavehq-test-1`         |
     | Role     | HOA Admin of Villa Alpha |

     The sign-in form takes the username or the email. The password is in version control on purpose — this account exists only in a local stack, and `db reset` recreates it every time.
5. Web: `pnpm --filter web dev` → runs Next.js on `http://localhost:3000`.
6. Mobile: `pnpm --filter mobile start` → opens Expo dev tools; scan the QR code with the **Expo Go** app on your phone, or press `a`/`i` for an emulator/simulator.

## Ports you'll be using locally

- `3000` — Next.js web app
- `54321` (default) — Supabase local API
- `54322` — Postgres itself (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`)
- `54323` — Supabase Studio (local DB admin UI in the browser)
- `54324` — Mailpit, which catches every email the local Auth server sends
- Expo's Metro bundler picks its own port (usually `8081`)

## Minimum machine specs

- 8GB RAM works but 16GB is much more comfortable (Docker + Android emulator + Node + browser all running at once).
- Reasonably free disk space — Android Studio's SDK + emulator images alone can take several GB.

## Testing on a real device (recommended over emulators early on)

Install the **Expo Go** app on your own Android/iPhone and scan the QR code from `pnpm --filter mobile start` — this is the fastest way to see real changes without emulator overhead, and it's how you'll want to test the camera/photo-upload flow for payment receipts anyway (emulator cameras are unreliable).
