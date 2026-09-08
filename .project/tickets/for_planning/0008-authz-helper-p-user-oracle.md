# 0008 — The authz helpers answer for an arbitrary user

**Filed:** 2026-09-08
**Stage:** for_planning
**Source:** `SEC-1`, the one substantive finding of ticket 0007's security review
(`.agent-work/0007-portal-shell-and-today/security-review.md`). Classified **MEDIUM** and
**`[PRE-EXISTING]`** — it predates 0007 and did not block it.

## What was found

Four `SECURITY DEFINER` helpers take a `p_user` parameter and will answer about **any** user id,
for **any** authenticated caller:

- `public.is_super_admin(p_user)`
- `public.current_village_ids(p_user)`
- `public.user_has_permission(p_permission, p_village, p_user)`
- `public.is_village_admin(p_village, p_user)`

Reproduced by the reviewer against the running stack. An `authenticated` JWT for a principal with
**no `public.users` row at all** — a session in which RLS correctly returns `[]` for
`GET /rest/v1/users` — still received:

```
POST /rest/v1/rpc/user_has_permission  {"p_permission":"users.manage","p_village":"<alpha>","p_user":"<admin id>"}
  -> 200 true

POST /rest/v1/rpc/current_village_ids  {"p_user":"<admin id>"}
  -> 200 ["72ddc4d0-…"]
```

With an ordinary resident account it chains: co-resident ids from your own village → the _other_
villages those people belong to → their capabilities in those villages. That is cross-tenant
authorisation metadata, disclosed to any signed-in user, in a product whose load-bearing constraint
is that a resident of one village must not learn about another.

## Why 0007 did not fix it

Ticket 0007 closed the **anonymous** half of this exact problem: the same four functions were
callable with the anon key, because `revoke … from anon` does not remove the `PUBLIC` grant that
`CREATE FUNCTION` creates. They are now `revoke … from public, anon` and granted only to
`authenticated` — see `docs/decisions/0002-village-scope-and-authz-seam.md` D1.

0007 also declined a `p_user` on the **new** `user_permission_keys`, and recorded why: a
`SECURITY DEFINER` function that enumerates an arbitrary user's grants is a bulk
permission-disclosure endpoint, so it only ever answers for `auth.uid()`. **That is the same
argument, and it applies to the four functions 0007 re-granted.** Fixing them was judged a
schema change deserving its own verification and its own review rather than a tack-on.

## The constraint that makes this non-trivial

These four functions are called by the **RLS policies** in
`supabase/migrations/20260906120000_identity_and_rbac.sql`. Break them and authorisation breaks
everywhere, not just in the portal.

The promising detail: as far as 0007 observed, **no policy passes `p_user` explicitly** — every
call site relies on the `default auth.uid()`. If that holds under a full audit, the parameter can
be removed rather than merely restricted. Verify it; do not assume it.

Options planning should weigh, in rough order of preference:

1. **Drop `p_user` entirely**, resolving `auth.uid()` inside each body. Cleanest, and matches
   `user_permission_keys`. Requires auditing every caller — policies, triggers, and the new
   TypeScript seam at `apps/web/src/features/authz/`.
2. **Keep the parameter for internal use, revoke `EXECUTE` from `authenticated` on the
   `p_user`-taking signatures, and expose parameterless wrappers** for anything PostgREST should
   reach. More surface, but a smaller blast radius if a caller was missed.
3. **Gate the parameter inside the body** — permit a non-self `p_user` only when the caller holds
   `users.read` in the relevant village. Preserves a legitimate "what can _they_ do?" question that
   the Roles & access screen will eventually need, at the cost of a policy decision inside a helper.

Option 3 is worth real thought rather than dismissal: ticket 0007's ADR notes that when Roles &
access is built it will need exactly that question answered, and a blanket ban means inventing a
second mechanism then.

## Also in scope, if cheap

Five **trigger** functions still carry the `PUBLIC` / `anon` grants that 0007's fix removed from the
other five: `set_updated_at`, `handle_new_user`, `handle_auth_user_updated`,
`users_guard_privileged_columns`, `user_roles_guard_scope`. They return `trigger`, so Postgres
refuses direct invocation and PostgREST returns 404 — **not reachable, and deliberately left**. But
the ACL listing reads inconsistently to anyone auditing it later, which is its own small cost.

## Verification this ticket will need

The reviewer's reproduction is the acceptance test, inverted: mint an `authenticated` JWT for a
principal with no profile row, and confirm every one of the four calls above is refused. Then
confirm RLS still behaves — the seeded `alpha_admin` must still see Villa Alpha and not Villa Bravo,
and `pnpm supabase db reset` must still apply cleanly.
