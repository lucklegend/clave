-- ---------------------------------------------------------------------------
-- Residents directory — the read path (ticket 0014)
--
-- ## Why these are `security definer` when `announcement_status_counts` is not
--
-- The board must show which role each person holds, and RLS will not allow it.
-- `user_roles_select` admits a grant row only to the person it names, to a
-- village admin, or to a super admin — and `is_village_admin` resolves through
-- `users.manage`, which **officers do not hold**. An officer reading
-- `user_roles` over PostgREST sees exactly their own grant and nothing else, so
-- the Role column and every filter tab would be blank for them.
--
-- Note precisely what is and is not being worked around. `users_select` already
-- admits an officer to every `public.users` row in their village, because their
-- scoped grant puts that village in `current_village_ids()`. **These functions
-- exist to disclose role grants, not profiles.** That is a real widening of
-- `user_roles_select` for people holding `users.read`, and it is the decision
-- recorded in `docs/decisions/0006-residents-and-the-second-service-role-reader.md`
-- rather than an implementation detail.
--
-- ## What that costs, and what pays for it
--
-- `security definer` runs as the owner, so RLS is off inside these bodies and
-- the tenancy rule stops being the database's job. `p_village` and the
-- `user_has_permission('users.read', p_village)` guard are then the *entire*
-- boundary between one village's roster and the next. Two ways that breaks
-- later, both worth guarding in review: somebody adds a convenience overload
-- without the guard, or somebody lets `p_village` arrive from a URL segment
-- instead of from `loadAuthzContext()`. Every caller in `apps/web` takes the
-- resident id from the URL and the village from the session, for this reason.
--
-- ## `set search_path = ''` and the trap that is not obvious
--
-- Every identifier below is schema-qualified, types included. The part that
-- catches people: **operator lookup also goes through `search_path`**. `citext`'s
-- `=` lives in `extensions`, so the moment anyone adds `where u.email = p_email`
-- inside one of these functions it fails with "operator does not exist:
-- citext = citext" rather than returning a wrong answer. Nothing here compares a
-- citext value — `email` and `username` are only ever cast to `text` on the way
-- out — and the invite flow's email lookup goes through PostgREST from
-- TypeScript instead. Keep it that way.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The unguarded helper. Never reachable from a client.
-- ---------------------------------------------------------------------------

/*
 * One place where a set of role grants becomes a single display label.
 *
 * It carries **no permission check on purpose** — it is the shared body of the
 * three guarded functions below, and duplicating the CASE into each of them is
 * how the board and the tabs would eventually disagree about what "Admin"
 * means. The safety property is that nothing can call it: it is revoked from
 * `public`, `anon` **and** `authenticated`, so PostgREST cannot reach it under
 * the anon or an authenticated key, while the definer functions below still can
 * because owner rights survive a revoke from PUBLIC.
 *
 * Three decisions are baked into the body.
 *
 * **`u.village_id = p_village` is the person's *home* village, not "any village
 * they hold a grant in".** It matches what `users.village_id` means, what the
 * invite flow writes, and the primary term of `users_select`. The consequence is
 * real and should be understood before it is discovered: a guard whose home
 * village is Alpha but who holds a `guard` grant in Bravo does not appear on
 * Bravo's roster. If that turns out to be wrong for the product, the change is a
 * union on `user_roles.village_id = p_village` here and nowhere else — but it
 * also changes who the edit page may act on.
 *
 * **Several grants collapse to one label by precedence, and the precedence is
 * the enum's own declaration order** — admin, crew, guard, owner, tenant. So
 * somebody holding both `officer` and `owner` in one village reads as Admin and
 * is absent from the Owner tab. That is a display rule and never a security
 * rule; nothing is hidden by it, the person is still on the All tab.
 *
 * **A super admin is excluded by an anti-join on the grant, not by calling
 * `is_super_admin`.** That function is itself `security definer`, so Postgres
 * will not inline it and it becomes one call per row; the anti-join becomes a
 * hash anti-join backed by `user_roles_global_idx`, which is
 * `(user_id, role_id) where village_id is null` — precisely this shape. Someone
 * carrying a blanket `user_permissions` allow is not a super admin and stays on
 * the roster, which is right.
 *
 * A person with no grant at all, or with only a village-defined custom role,
 * gets `role_key = null`. That is the state an invited person sits in before an
 * admin grants them a role, so it is an ordinary value and not an anomaly.
 */
create or replace function public.residents_in_village(
  p_village uuid,
  p_role public.resident_role default null,
  p_id uuid default null
)
returns table (
  id uuid,
  full_name text,
  username text,
  email text,
  phone text,
  avatar_url text,
  status public.user_status,
  address_room text,
  address_block text,
  address_lot text,
  address_street text,
  address_phase text,
  created_at timestamptz,
  role_key public.resident_role
)
language sql
stable
security definer
set search_path = ''
as $$
  with labelled as (
    select
      u.id,
      u.full_name,
      -- Explicit casts, not decoration: both columns are `extensions.citext`,
      -- and declaring them `text` above while selecting them bare would lean on
      -- a binary coercibility that reads as an accident.
      u.username::text as username,
      u.email::text as email,
      u.phone,
      u.avatar_url,
      u.status,
      u.address_room,
      u.address_block,
      u.address_lot,
      u.address_street,
      u.address_phase,
      u.created_at,
      (
        select case
          when bool_or(r.key in ('hoa_admin', 'officer')) then 'admin'::public.resident_role
          when bool_or(r.key = 'maintenance') then 'crew'::public.resident_role
          when bool_or(r.key = 'guard') then 'guard'::public.resident_role
          when bool_or(r.key = 'owner') then 'owner'::public.resident_role
          when bool_or(r.key = 'tenant') then 'tenant'::public.resident_role
        end
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = u.id
          and ur.village_id = p_village
      ) as role_key
    from public.users u
    where u.village_id = p_village
      and (p_id is null or u.id = p_id)
      and not exists (
        select 1
        from public.user_roles sa
        join public.roles sr on sr.id = sa.role_id
        where sa.user_id = u.id
          and sa.village_id is null
          and sr.key = 'super_admin'
      )
  )
  select
    l.id,
    l.full_name,
    l.username,
    l.email,
    l.phone,
    l.avatar_url,
    l.status,
    l.address_room,
    l.address_block,
    l.address_lot,
    l.address_street,
    l.address_phase,
    l.created_at,
    l.role_key
  from labelled l
  -- Filtered here rather than in the CTE because `role_key` is derived and has
  -- no existence until the CTE has produced it.
  where p_role is null or l.role_key = p_role;
$$;

-- Revoked from `authenticated` as well, which the three functions below are not.
-- This one has no tenancy check inside it, so it must not be an endpoint. Owner
-- rights survive this, which is what lets the guarded functions call it.
revoke all on function public.residents_in_village(uuid, public.resident_role, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The three guarded reads
-- ---------------------------------------------------------------------------

/*
 * One page of the roster.
 *
 * **The guard is a `where` clause rather than a raised exception**, so a caller
 * without `users.read` in this village receives zero rows instead of an error.
 * The predicate carries no Var, so the planner evaluates it once as a one-time
 * filter — the same shape `20260908130000_user_permission_keys.sql` records for
 * its super-admin term. Correctness does not lean on that: evaluated per row the
 * answer is still nothing.
 *
 * **`p_limit` is clamped here as well as in TypeScript.** The exposure is not
 * injection — there is no dynamic SQL anywhere in this file, `p_role` is
 * compared and never interpolated, and the paging arguments are bound integers.
 * It is resource exhaustion: an unbounded limit lets one request make the server
 * assemble arbitrarily much HTML, which is what `RESIDENT_PAGE_SIZES` in
 * `features/residents/server/queries.ts` is also written against. The clamp
 * additionally swallows a negative offset, which Postgres would otherwise raise
 * on and the query layer would misreport as an outage.
 *
 * **The `id` tiebreak in the ordering is correctness, not tidiness.** With
 * offset paging and no total order, two people sharing a name can appear on both
 * page one and page two, or on neither, because the plan's tie order is not
 * stable across statements. `nulls last` is spelled out because `full_name` is
 * genuinely nullable — a phone-OTP account has none.
 */
create or replace function public.residents_list(
  p_village uuid,
  p_role public.resident_role default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  username text,
  email text,
  phone text,
  avatar_url text,
  status public.user_status,
  address_room text,
  address_block text,
  address_lot text,
  address_street text,
  address_phase text,
  created_at timestamptz,
  role_key public.resident_role
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.full_name,
    r.username,
    r.email,
    r.phone,
    r.avatar_url,
    r.status,
    r.address_room,
    r.address_block,
    r.address_lot,
    r.address_street,
    r.address_phase,
    r.created_at,
    r.role_key
  from public.residents_in_village(p_village, p_role, null) r
  where p_village is not null
    and public.user_has_permission('users.read', p_village)
  order by r.full_name asc nulls last, r.id asc
  limit least(greatest(coalesce(p_limit, 10), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

/*
 * How many people sit under each tab.
 *
 * Two functions rather than one returning both, because a single one would have
 * to repeat the counts on every row or return `json` — and `json` arrives in the
 * generated types as `Json`, which throws away the typed row shape the rest of
 * this feature is built on. Two is also the shape `(portal)/announcements/page.tsx`
 * already runs under one `Promise.all`.
 *
 * **These counts drive the pager, so nothing anywhere asks PostgREST for an
 * exact count.** The announcements board needs one because its filter is a
 * `where` on the list query; here the filtered total for the current tab *is*
 * this function's row for that tab, and the All total is the sum. One fewer
 * round trip, and the pills and the pager cannot disagree because they are the
 * same read.
 *
 * A null `role_key` is grouped and returned like any other: people with no grant
 * yet are counted, and the page adds them into All.
 */
create or replace function public.residents_role_counts(p_village uuid)
returns table (role_key public.resident_role, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.role_key, count(*)
  from public.residents_in_village(p_village, null, null) r
  where p_village is not null
    and public.user_has_permission('users.read', p_village)
  group by r.role_key;
$$;

/*
 * One resident, for the view modal and the edit page.
 *
 * **Village-scoped by construction, and it must stay that way.** The helper
 * filters on `u.village_id = p_village`, so an id belonging to another village
 * returns zero rows — which the query layer turns into `{ row: null }` and the
 * route into a 404, indistinguishable from a resident who was never there.
 * Turning this into a lookup by id alone would be a cross-village read with a
 * friendly signature.
 */
create or replace function public.resident_by_id(p_village uuid, p_resident uuid)
returns table (
  id uuid,
  full_name text,
  username text,
  email text,
  phone text,
  avatar_url text,
  status public.user_status,
  address_room text,
  address_block text,
  address_lot text,
  address_street text,
  address_phase text,
  created_at timestamptz,
  role_key public.resident_role
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.full_name,
    r.username,
    r.email,
    r.phone,
    r.avatar_url,
    r.status,
    r.address_room,
    r.address_block,
    r.address_lot,
    r.address_street,
    r.address_phase,
    r.created_at,
    r.role_key
  from public.residents_in_village(p_village, null, p_resident) r
  where p_village is not null
    and p_resident is not null
    and public.user_has_permission('users.read', p_village);
$$;

-- `CREATE FUNCTION` grants EXECUTE to PUBLIC, and revoking from `anon` alone
-- does nothing about that — the anon role inherits it. Revoke from `public`
-- first, then grant back to `authenticated`, exactly as
-- `20260909130000_announcement_status_counts.sql` records.
revoke all on function public.residents_list(uuid, public.resident_role, integer, integer)
  from public, anon;
revoke all on function public.residents_role_counts(uuid) from public, anon;
revoke all on function public.resident_by_id(uuid, uuid) from public, anon;

grant execute on function public.residents_list(uuid, public.resident_role, integer, integer)
  to authenticated;
grant execute on function public.residents_role_counts(uuid) to authenticated;
grant execute on function public.resident_by_id(uuid, uuid) to authenticated;
