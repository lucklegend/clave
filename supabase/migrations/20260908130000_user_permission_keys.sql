-- The set-returning capability lookup, and a correction to the function grants in
-- 20260906120000_identity_and_rbac.sql.
--
-- A new file rather than an edit to that migration: it has been applied, and a database that
-- skips a reset would keep the old definitions while the repository claimed otherwise.

-- ---------------------------------------------------------------------------
-- public.user_permission_keys — every capability the caller holds, in one round trip
-- ---------------------------------------------------------------------------

-- Drawing the portal shell asks roughly fifteen permission questions at once (eleven navigation
-- destinations plus the work-queue rows). Fifteen calls to public.user_has_permission is fifteen
-- round trips to answer one page, so this answers all of them together.
--
-- It takes no `p_user`, and that is the one deliberate divergence from the four helpers above it.
-- Those answer one boolean about one named key; this enumerates a whole account's capabilities,
-- and a SECURITY DEFINER version of that accepting an arbitrary user id is a bulk
-- permission-disclosure endpoint reachable over PostgREST. It is the same objection
-- `apps/web/src/features/auth/server/resolve-identifier.ts` records about exposing a username
-- lookup as an RPC: the answer is only ever needed about the caller, so only the caller can be
-- asked about.
--
-- The precedence is public.user_has_permission's, written as set operations rather than a CASE
-- ladder, because a ladder decides one key at a time and this decides all of them at once:
--
--     granted = direct allow ∪ (the whole catalogue, if super admin) ∪ role grants in scope
--     result  = granted − direct deny
--
-- so a `deny` still beats everything, including super admin. The unique indexes on
-- user_permissions are *partial*, so one global row and one village-scoped row for the same
-- permission is a legal pair; taking the deny out of the union at the end rather than choosing
-- between the rows means a deny on either wins over an allow on the other.
--
-- One behavioural difference from public.user_has_permission, and it is an improvement rather
-- than a match: asked about a key that is not in the catalogue, that function returns true for a
-- super admin, because its super-admin branch fires before anything checks the key exists. This
-- returns false for the same key, because the super-admin term enumerates public.permissions and
-- a typo is not in it. The two are therefore not interchangeable at the margin.
create or replace function public.user_permission_keys(p_village uuid default null)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  with direct as (
    select p.key, up.effect
    from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = (select auth.uid())
      and (up.village_id is null or up.village_id = p_village)
  ),
  granted as (
    select d.key from direct d where d.effect = 'allow'
    union
    -- No Var in the qual, so the planner evaluates it once as a one-time filter rather than per
    -- catalogue row.
    select p.key from public.permissions p
    where public.is_super_admin((select auth.uid()))
    union
    select p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = (select auth.uid())
      and (ur.village_id is null or ur.village_id = p_village)
  )
  select g.key from granted g
  except
  select d.key from direct d where d.effect = 'deny';
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- `revoke all on function … from anon` in 20260906120000_identity_and_rbac.sql:485-488 did not
-- do what it reads as. CREATE FUNCTION grants EXECUTE to PUBLIC, and revoking from a role does
-- not remove a grant made to PUBLIC — anon kept inheriting it. Verified against the local stack
-- before this migration was written: all four helpers answered over PostgREST with the anon key
-- that ships in the browser bundle, `user_has_permission('users.manage', <village>, <user>)`
-- returning true and `current_village_ids(<user>)` returning that account's village ids. Both
-- take a user id, so either one enumerates a stranger's grants.
--
-- Order matters: revoke first, then grant. Supabase's default privileges grant EXECUTE on new
-- functions to anon as well as to authenticated, so a revoke that ran first and a grant that ran
-- second is the only sequence that leaves authenticated holding it and anon not.

revoke all on function public.is_super_admin(uuid) from public, anon;
revoke all on function public.current_village_ids(uuid) from public, anon;
revoke all on function public.user_has_permission(text, uuid, uuid) from public, anon;
revoke all on function public.is_village_admin(uuid, uuid) from public, anon;
revoke all on function public.user_permission_keys(uuid) from public, anon;

grant execute on function public.is_super_admin(uuid) to authenticated;
grant execute on function public.current_village_ids(uuid) to authenticated;
grant execute on function public.user_has_permission(text, uuid, uuid) to authenticated;
grant execute on function public.is_village_admin(uuid, uuid) to authenticated;
grant execute on function public.user_permission_keys(uuid) to authenticated;
