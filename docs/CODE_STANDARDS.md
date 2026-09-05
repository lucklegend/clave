# Heartbeat ClaveHQ — Code Best Practices

Written so you can follow along even if you're not deep into this stack yet. The goal: any file you open should be predictable, and Claude Code should be able to make changes without breaking things elsewhere.

## 1. Language & typing

- **TypeScript everywhere**, `strict: true` in every `tsconfig.json`. No `any` unless there's a comment explaining why.
- Define your data shapes **once**, in `packages/shared/types`, and import them in both `apps/web` and `apps/mobile`. Never redefine "what a Payment looks like" in two places.
- Use **Zod** schemas (in `packages/shared/schemas`) for anything crossing a boundary — form input, API responses, Supabase rows. Zod gives you both the TypeScript type _and_ runtime validation from one definition.

## 2. Folder structure — feature-based, not type-based

Avoid grouping by file type (`components/`, `hooks/`, `screens/` as giant flat folders). Group by feature instead:

```
apps/mobile/src/
├── features/
│   ├── payments/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api.ts
│   │   └── types.ts
│   ├── announcements/
│   ├── bookings/
│   └── reports/
├── shared-ui/        # buttons, cards, inputs used across features
└── navigation/
```

When you (or Claude Code) work on "bookings," everything relevant lives in one folder.

## 3. Data fetching

- Use **TanStack Query (React Query)** for every network call, in both web and mobile. It gives you caching, loading/error states, and automatic refetching for free — don't hand-roll `useEffect` + `useState` fetch logic.
- All Supabase calls go through functions in `packages/shared/api`, never called ad-hoc inside a component. If the API shape changes, you fix it in one place.

## 4. State management

- Local UI state → `useState`/`useReducer`.
- Shared client state (e.g., "which village is the admin currently viewing") → **Zustand** (small, no boilerplate) rather than Redux.
- Server data (payments, bookings, announcements) is **not** app state — it's React Query cache. Don't duplicate it into Zustand.

## 5. Styling

- Web: Tailwind CSS.
- Mobile: NativeWind (Tailwind syntax for React Native) so your styling vocabulary is identical on both platforms.

## 6. Testing

- **Vitest** for unit tests (business logic, Zod schemas, utility functions in `packages/shared`).
- **React Native Testing Library** / **React Testing Library** for component tests on critical flows (payment upload, booking creation).
- You don't need 100% coverage on day one — prioritize the money paths: payment status changes, booking conflict logic, role-based access checks.

## 7. Linting & formatting

- ESLint + Prettier, one shared config in `packages/config`, referenced by both apps.
- **Husky** + `lint-staged`: block commits that fail lint/type-check.
- Run `tsc --noEmit` in CI so type errors fail the build, not just your editor.

## 8. Git workflow

- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`) — makes it easy to scan history and (later) auto-generate changelogs.
- One feature = one branch = one PR, even if you're the only developer — keeps `main` always deployable and gives Claude Code a clean diff to review.
- Small PRs over big ones — easier for you to review Claude Code's output line by line while you're still learning the stack.

## 9. Environment & secrets

- All config via `.env` files, never hardcoded. Validate them at startup with a Zod schema (`packages/shared/env.ts`) so a missing key fails loudly at boot, not silently at 2am.
- `.env.example` committed to the repo with dummy values; real `.env` files are git-ignored.

## 10. Multi-tenancy safety

- Every database query must be scoped by `village_id`, enforced by Supabase RLS policies — **never rely on the frontend alone to filter by village.** Treat this as the single most security-critical rule in the whole codebase.

## 11. Documentation habits

- Every non-obvious decision (e.g., "why Supabase over custom backend," "why screenshots instead of gateway integration in v1") gets a short note in `docs/decisions/` (an ADR — Architecture Decision Record). One paragraph is enough. Future-you (or Claude Code in a new session) will thank you.
- Keep `HANDOFF.md` current — see that file for the format.
