# 0002 — Village scope, the authz seam, and a grants fix

**Date:** 2026-09-08
**Status:** Accepted
**Ticket:** `0007-portal-shell-and-today`

## Context

Ticket 0007 built the admin portal shell and the Today dashboard, and in doing so closed a gap
open since ticket 0003: nothing in TypeScript had ever called `public.user_has_permission`. The
SQL existed, the generated types were ready, and there was no call site — `/dashboard`'s stub
read `user_roles` for display, which resolves neither `deny` overrides nor super admin. Building
the drawer's capability gating forced the first real caller into existence, and in verifying the
existing helpers before adding a sixth, this ticket found a live vulnerability in five of them.
Five decisions came out of the work; recording them here because at least one — the grants fix —
is the kind of mistake that will recur if the lesson isn't named precisely.

## Decisions

### D1 — the function grants were wrong, and it was live

`supabase/migrations/20260906120000_identity_and_rbac.sql:485–488` revoked `is_super_admin`,
`current_village_ids`, `user_has_permission` and `is_village_admin` from `anon` only:

```sql
revoke all on function public.is_super_admin(uuid) from anon;
-- …and three more, all `from anon`
```

`CREATE FUNCTION` grants `EXECUTE` to `PUBLIC` by default, and revoking a privilege from a role
does not remove a grant held by `PUBLIC` — `anon` kept inheriting it through that grant, untouched
by the revoke aimed at `anon` directly. Reproduced against the running local stack: all four
functions answered over PostgREST with the anon key that ships in the browser bundle.
`user_has_permission('users.manage', <village>, <user>)` returned `true`, HTTP 200, with no
session. `current_village_ids` was the worst of the four — not a boolean oracle but a direct
handover of a named user's village ids, which is the join key nearly everything else in the
schema is scoped by. A control request in the same session, `GET /rest/v1/users?select=id`,
correctly returned `42501` (permission denied), which is what proves the fault was narrow: **table
RLS was fine; only these four function grants were wrong.** It shipped in ticket 0003 and was live
on `main` until this branch.

Fixed in the new migration `20260908130000_user_permission_keys.sql`, for these four and the new
fifth function alike:

```sql
revoke all on function public.is_super_admin(uuid) from public, anon;
grant execute on function public.is_super_admin(uuid) to authenticated;
-- …repeated for current_village_ids, user_has_permission, is_village_admin, user_permission_keys
```

Order matters: Supabase's own default privileges grant `EXECUTE` on a newly created function to
`anon` as well as `authenticated`, so revoke-then-grant is the only sequence that leaves
`authenticated` holding it and `anon` not. Written as a new file rather than an edit to the
applied migration, per this repo's rule against editing a migration that has already run.

**The lesson, in one sentence: `revoke … from anon` is not sufficient for a function; it must be
`revoke … from public`.** The class of mistake is generic to Postgres function privileges, not to
this schema, and will recur anywhere a helper is revoked from a role by name instead of from
`PUBLIC`.

**Left alone, and worth naming so the ACL doesn't look like an oversight to the next reader:**
five _trigger_ functions in the same migration (`set_updated_at`, `handle_new_user`,
`handle_auth_user_updated`, `users_guard_privileged_columns`, `user_roles_guard_scope`) still carry
the default `PUBLIC`/`anon` grant. They are not reachable the same way — a function returning
`trigger` cannot be invoked directly, Postgres refuses it, and PostgREST answers with a 404 rather
than running it. Deliberately left as-is by this ticket rather than tidied, but the grant listing
now reads as inconsistent — five helpers locked down, five triggers not — to anyone who runs
`\df+` without also checking each one's return type.

### D2 — `user_permission_keys` takes no `p_user`, and diverges from `user_has_permission` by design

`user_permission_keys(p_village uuid default null) returns setof text` answers every capability
the shell needs about the caller in one round trip, instead of the roughly fifteen calls to
`user_has_permission` that drawing one page (eleven nav destinations, four work-queue rows) would
otherwise take.

It is the one place this diverges from the four existing helpers on purpose: they all accept
`p_user`, resolving to `auth.uid()` only as a default. A `SECURITY DEFINER` function that
enumerates an _arbitrary_ user's capabilities and is reachable with the anon key is a bulk
permission-disclosure endpoint — the same objection
`apps/web/src/features/auth/server/resolve-identifier.ts` already records about exposing a
username lookup as an RPC. `user_permission_keys` takes no `p_user` at all; the answer is always
about `(select auth.uid())`, and there is no parameter to widen that with later.

**The two functions are not interchangeable at the margin, and that is worth knowing before an
incident rather than during one.** Asked about a permission key that is not in the catalogue,
`user_has_permission` returns **true** for a super admin — its super-admin branch is a `CASE` arm
that fires before anything checks whether the key exists. `user_permission_keys` returns **false**
for the same key, because its super-admin term is `select p.key from public.permissions p where
is_super_admin(...)`, which enumerates the real catalogue and a typo'd key is simply not a row in
it. Both behaviours were verified against the local stack while building S1. The set function's
answer is the better one, but "better" is not "the same," and nobody should learn the difference
by watching one code path return a stale `true`.

### D3 — village scope is server-resolved, not URL- or cookie-scoped

The portal resolves a caller's active village from `users.village_id` (falling back to the first
village the RLS-filtered `villages` select returns) on every request, in
`features/authz/server/context.ts`. There is no `/v/[village]` route segment and no village cookie.

**This directly contradicts a line in `CLAUDE.md`'s Authorisation-adjacent conventions**: "Zustand
holds only client state, such as which village an admin is currently viewing." That sentence
describes a client-rendered app with a TanStack Query cache in front of it. Neither exists on this
branch — the portal is server-rendered, mutations are Server Actions, and TanStack Query and
Zustand are still just documented in `docs/FRONTEND.md`, not installed. Recording the contradiction
here rather than silently letting the two documents disagree; `CLAUDE.md`'s Authorisation section
is updated alongside this ADR to point at the seam that actually exists (see below), but the
Zustand sentence itself is unchanged and now describes a mechanism that has not been built.

**The consequence, stated plainly: the village pill in the top-of-drawer switcher displays but
cannot switch.** It renders the resolved village's name and tier and draws a chevron, because that
is what the canvas specifies, but there is nowhere server-resolved scoping can write a selection
back to — no cookie, no URL segment. This is deferred work with its own ticket and a scope
mechanism to design, not dropped work; `CLAUDE.md` already designs multi-village membership in
from the start (one person can be an owner in village A and an officer in village B, which is two
`user_roles` rows), so a switcher is coming, just not on this branch.

**The constraint this decision buys, and the reason it is being written down rather than left to
be discovered by whoever adds a `revalidate`:** every portal route must stay dynamically rendered.
The village is resolved from the session on every request; a `"use cache"` or a `revalidate` added
to a portal route later would serve one village's server-rendered output to the next request in
another village, and that is a cross-tenant leak Row-Level Security never sees, because RLS was
satisfied for the request that produced the cached response. `docs/FRONTEND.md` §1 already names
this hazard for data reads generically; this decision is the reason it also applies to page-level
caching on every route under `app/(portal)/`.

### D4 — rejected: stamping the permission set into the JWT

Considered and rejected: a Supabase custom access token hook that adds the caller's permission set
to the JWT at mint time, removing both the village lookup and the `user_permission_keys` call from
every render. Rejected because it moves the staleness bound from "next request" to "token
lifetime" — a `deny` written to `user_permissions` after a token was minted would not take effect
until that token expires, roughly an hour, with no server-side lever to shorten it. A revoked
grant that stays effective for an hour is a worse failure mode than two extra round trips per
render. Recording the rejection here because it is an obvious-looking optimisation and will very
likely be proposed again; this is where the answer lives when it is.

### D5 — the route guard inverted to deny-by-default

`apps/web/src/proxy.ts` used to hold `PROTECTED_PREFIXES`, an allow-list of paths that needed a
session. Ticket 0007 replaced it with `PUBLIC_EXACT = ["/"]` and
`PUBLIC_PREFIXES = ["/sign-in", "/auth/callback"]`, guarding everything else by default. Under the
old shape, a new portal route was public until someone remembered to add it to the list; under the
new shape, a new route is guarded until someone deliberately opens it. The cost of forgetting
moved from a silent, unauthenticated read of a village's data to a redirect loop — loud, and fixed
in minutes.

Two consequences of the inversion, both worth recording precisely because each one looks like a
different bug to whoever hits it first:

- **`/auth/callback` must be named public, or Google sign-in breaks in an infinite loop, every
  time.** The callback arrives carrying a PKCE code and no session cookie yet — exchanging the
  code for that cookie is the route's entire job — so under deny-by-default the guard would find
  no claims and bounce to `/sign-in`, which sends the browser to Google, which returns it to the
  callback, unguarded-but-cookieless again. The symptom reads exactly like a misconfigured
  Supabase redirect URL and would be chased there first.
- **The proxy's matcher is now a security boundary in both directions.** Before the inversion, a
  path wrongly excluded from the matcher cost a missed token refresh. Now it costs an open route:
  an excluded path is not "public," it is _unguarded_, because the proxy never runs on it at all.
  Every exclusion added to the matcher (`robots.txt`, `sitemap.xml`, `site.webmanifest`,
  `.well-known/`, the asset extensions) is a decision to leave a path unguarded, not a performance
  tweak, and is named explicitly rather than inferred from "any segment with a dot in it" — the
  `users_username_format` check permits a `.` in a username, so that shortcut would silently
  unguard a future `/u/jane.doe`.

## Consequences and open questions

- The village switcher ships inert. It needs its own ticket once a scope mechanism (cookie, URL
  segment, or something else) is designed.
- Every route under `app/(portal)/` must stay dynamically rendered for as long as village scope is
  resolved per-request with no cache key that includes it. A future ticket adopting Next's
  `cacheComponents` for the portal has to either exclude these routes or fold village id into the
  cache key explicitly.
- A super admin's village switcher would list every village on the platform once it can switch,
  since the RLS-filtered `villages` select returns the whole table to them. Not a problem yet at
  this scale; will need a bound before there are more than a handful of villages.
- `user_has_permission` and `user_permission_keys` diverging on an unknown key is now documented
  here and in the migration's own comments, but nothing enforces that a caller picks the right one
  for the right question. A single guard at a mutation boundary should call `user_has_permission`;
  drawing a page's worth of gates should call `user_permission_keys`. Mixing them up is not a type
  error today.

## Alternative considered

A `/v/[village]` URL segment or a village-selection cookie, either of which would have given the
switcher somewhere to write to on this branch. Rejected for scope, not for correctness — ticket
0007's job was the shell and Today, and a URL scheme or cookie policy for village switching is a
big enough decision (bookmarks, shared links, and the flat-URL assumption several other pieces of
this ticket rely on) that it deserves its own ticket rather than a default picked to unblock a
pill that currently has no other job than to display correctly.
