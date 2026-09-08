# 0003 — Sign-in page, Supabase auth, and the RBAC schema

**Filed:** 2026-09-06
**Stage:** completed

## What was asked

> can we plan for the signin page. we should have login and password it should be in
> the center and can you move the logo of claveHQ from the landing page and add it
> above the login form also add remember me. so the basic will be usernme:
> placeholder will be email/username, password then has ---or--- lets use google
> oAuth login and also apply the necessarily configs. we should also create database
> for user table, let also creat user_permission table user_role table and role table
> and permission table. check my local setting if I have postres db if not lets
> install it.

## Settled with the user before building — 2026-09-06

1. **Supabase local via Docker**, not a standalone Postgres install. No Postgres was
   present on the machine; Docker Desktop was installed but not running. The Supabase
   CLI's stack _is_ the project's Postgres, and it brings Auth (email/password and
   Google both) and Storage with it, so nothing has to be hand-rolled and nothing has
   to be redone when the rest of the backend lands.
2. **The mark is shared, not moved.** The landing hero keeps it — it is the right-hand
   column of a two-column grid at ≥960px and deleting it leaves a hole. `HeroMark`
   became `features/brand/components/BrandMark.tsx`, rendered by both.
3. **Email _or_ username**, matching the requested placeholder. Adds a `username`
   column and a server-side resolver.
4. **Full working sign-in**, not a UI shell: schema, RLS, session, OAuth callback, and
   a `/dashboard` stub to land on.

## Two settled decisions this changes, deliberately

1. **Auth method.** `docs/TECH_STACK.md` and `HANDOFF.md` settled on **phone OTP**,
   because PH users are phone-first. The web portal is now password + Google. Phone
   OTP stays the planned mobile/resident path and is not foreclosed: `users.phone` is
   carried from day one, `users.email` is nullable, and the `users_contactable` CHECK
   requires one or the other — so a phone-only account is a valid row today.
2. **`profiles` → `users`.** `docs/TECH_STACK.md` sketched the profile table as
   `profiles`. It is `public.users`, which reads with `user_roles` and
   `user_permissions`. `auth.users` still holds credentials and is Supabase's.

## One table nobody asked for

`public.villages`. CLAUDE.md's load-bearing constraint is that every table carries a
`village_id` filtered by RLS; `users.village_id` cannot be a foreign key and its policy
cannot be written without a tenant root. Minimal: id, name, slug, tier, timestamps.

## What is not optional but was not listed

`public.role_permissions`. A `roles` table with no join to `permissions` authorises
nothing — it is a list of labels.

## Where it landed

- `supabase/migrations/20260906120000_identity_and_rbac.sql` — extensions, enums, the
  seven tables, triggers, the authz helper functions, grants, and every RLS policy.
  One file because the policies call functions that read the tables; splitting it
  would ship a table with RLS on and no policy.
- `supabase/migrations/20260906120100_seed_roles_and_permissions.sql` — the 28-entry
  capability catalogue and the seven system roles from `PROJECT_PROPOSAL.md` §4.
- `packages/shared` — created. Zod sign-in schema, validated public env, generated
  database types.
- `apps/web/src/features/auth/` — clients, cookies, actions, form.
- `apps/web/src/features/brand/` — `BrandMark`, and the CTA class strings that 0002
  deferred extracting until a fourth caller appeared. `/sign-in` brought two.
- `apps/web/src/proxy.ts` — session refresh and the `/dashboard` guard. Next 16
  renamed the `middleware` file convention to `proxy`.

## Design notes worth not re-deciding

- **Every rejected credential returns one message.** Unknown username, unknown email,
  wrong password: same text, same absence of field attribution. An unresolved username
  is even handed to GoTrue as `unresolved-identifier@clavehq.invalid` rather than
  returning early, so the timing does not separate the two either.
- **A suspended account gets a different, specific message.** The password was
  correct, so the person has already proved the account exists — there is nothing left
  to conceal, and "invalid credentials" would send them to reset a working password.
- **The service-role key is read in exactly one module**,
  `features/auth/server/resolve-identifier.ts`, behind `import "server-only"`. A
  `security definer` RPC granted to `anon` was the alternative and is worse: the anon
  key is in the browser bundle by design, so that endpoint would harvest the email of
  every account on the platform in a loop.
- **"Remember me" is a cookie lifetime, not a stored preference.** Ticked → 30 days.
  Unticked → a session cookie. Verified in both directions.
- **A village admin cannot grant `super_admin`.** Without that exclusion in the
  `user_roles` write policy, an admin who may legitimately grant roles inside their
  own village could grant themselves the platform and leave the tenant boundary.
- **A non-`super_admin` role cannot be granted with a NULL `village_id`.** An unscoped
  grant matches every village in `user_has_permission`. This was not theoretical —
  the first test run created exactly that row by accident, and it silently gave a
  Villa Alpha officer payment verification in Villa Bravo.

## Follow-up — 2026-09-06

- **The link home moved onto the mark and the text wordmark was removed.** The
  artwork already sets "claveHQ" and the tagline in type, so the two together were
  the product name twice. The mark therefore gained an accessible name (`claveHQ`) it
  did not have while the wordmark carried it — an unlabelled image inside a link
  leaves a screen reader announcing the href. Shorter than the hero's
  "claveHQ — the heartbeat of your community", because a link's name should read as
  its destination.
- **`supabase/seed.sql` now creates a development account**, since Google is not yet
  configured and there was otherwise nothing to sign in with after a `db reset`:
  `alpha_admin` / `admin@villa-alpha.test` / `clavehq-test-1`, HOA Admin of Villa
  Alpha. Writing `auth.users` by hand is normally wrong, so the row was copied from
  one GoTrue actually produced — including the trap that `confirmation_token`,
  `recovery_token`, `email_change` and `email_change_token_new` must be `''` rather
  than NULL, or sign-in fails with an opaque `Database error querying schema`.

## Still open

- **Google sign-in is wired but inert** until a Google Cloud OAuth client ID and
  secret are in `.env` at the repo root. Authorized redirect URI must be
  `http://127.0.0.1:54321/auth/v1/callback` — Supabase's port, not Next's.
- `invited` status is accepted at sign-in and never flipped to `active`; the invite
  flow that would own that transition does not exist yet.
- No test runner in the repo, so the verification in `.agent-work/` is manual.

## Out of scope

Sign-up, password reset, invitations, the admin UI for assigning roles, and every
module behind `/dashboard`. The dashboard is a stub that proves the session, profile
and grants resolve.

## Delivered — reconciled 2026-09-07

Found and closed alongside ticket 0002 while filing 0004 (M3 theme adoption): this
ticket's branch, `feat/0003-sign-in-and-auth-schema`, was committed straight to `main`
as `9e5dc20` — "feat: sign-in with password and Google OAuth, and the RBAC schema" —
on top of 0002's `a6f9fd6`. The board was never updated to match; the ticket sat in
`in_progress` with no indication the code had already shipped.

Verification actually performed is recorded in `works.md`
(`.agent-work/0003-sign-in-and-auth-schema/works.md`, 2026-09-06): schema migrations,
`user_has_permission` authorisation cases (deny-beats-role, cross-village denial, the
NULL-`village_id` trigger rejection), RLS row-visibility per village, sign-in
(email/username/case-insensitive/wrong-password/unknown-identifier/suspended-account,
one identical rejection message throughout), route guards, and the Remember-me cookie
lifetime — all by hand against a real local Supabase stack, no test runner existing to
automate any of it.

**Gate and review status — worth reading before treating this as settled, more than
0001 or 0002.** `.agent-work/0003-sign-in-and-auth-schema/` contains **only
`works.md`** — no `plan.md`, no `design.md`, no `review.md`, no
`security-review.md`. This ticket built the RLS policies, the `SECURITY DEFINER`
authorisation functions, the service-role key's one sanctioned reader, and the
suspended-account/enumeration-resistant sign-in flow — CODE_STANDARDS.md's own words
call `village_id` RLS scoping "the single most security-critical rule" in the
codebase — and **none of it ever had a security review**, mid-loop or otherwise, let
alone a code review or the stage-6 merge gate. 0002's one security-sensitive step at
least got reviewed (`CLEARED WITH NOTES`); this ticket's security-relevant surface is
larger and got none. This is a real gap, not a formality — worth a standalone security
review of the auth/RBAC code before it carries more weight (real payment data,
production users), independent of the M3 theme ticket this reconciliation was done
for.
