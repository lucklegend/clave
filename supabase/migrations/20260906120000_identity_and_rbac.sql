-- Identity and role-based access control.
--
-- One migration rather than several, because the pieces are not separable: the RLS policies on
-- `users` call helper functions that read `user_roles`, and CLAUDE.md requires a village-scoped
-- table to ship its policy in the migration that creates it. Splitting this would mean shipping
-- at least one table with RLS enabled and no policy on it, which reads as "locked down" but is
-- really "unfinished".
--
-- Order inside the file: extensions -> enums -> tables -> triggers -> helper functions ->
-- grants -> policies. Every policy depends on the functions, every function on the tables.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Matches the free / Tier 1 split in docs/PROJECT_PROPOSAL.md §5.
create type public.village_tier as enum ('free', 'tier_1');

-- `invited` is a user an admin has created a row for who has not signed in yet; `suspended`
-- keeps the row (and its payment history) while denying access.
create type public.user_status as enum ('invited', 'active', 'suspended');

-- A direct grant can revoke as well as give. See public.user_has_permission below for how the
-- two combine.
create type public.permission_effect as enum ('allow', 'deny');

-- ---------------------------------------------------------------------------
-- villages — the tenant root
-- ---------------------------------------------------------------------------

-- The one table with no `village_id`: it *is* the village. Everything else in the schema is
-- scoped to a row here, and that scoping is what the RLS policies below enforce.
create table public.villages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug extensions.citext not null unique,
  tier public.village_tier not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cast to text so the regex is plain case-sensitive matching: `~` on citext does not fold
  -- case, and relying on it either way would be a guess about the operator class.
  constraint villages_slug_format check (slug::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- ---------------------------------------------------------------------------
-- users — the application profile, 1:1 with auth.users
-- ---------------------------------------------------------------------------

-- Named `users`, not `profiles` as docs/TECH_STACK.md sketched, so it reads with `user_roles`
-- and `user_permissions`. `auth.users` still holds the credentials — password hash, OAuth
-- identities, sessions — and is Supabase's to manage; this table holds everything the app owns.
--
-- `village_id` is nullable on purpose. A super admin belongs to no village, and a fresh Google
-- sign-up has none until an admin assigns one. A NULL here is "unassigned", and the select
-- policy below gives such a row no reader but itself and a super admin.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  village_id uuid references public.villages (id) on delete set null,
  -- Mirrored from auth.users by the triggers below, so username -> email resolution and admin
  -- listings do not have to read the auth schema. Nullable because phone OTP — still the
  -- planned resident path on mobile — produces an account with a phone and no email.
  email extensions.citext,
  username extensions.citext unique,
  full_name text,
  phone text,
  avatar_url text,
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An account nobody can reach is an account nobody can recover.
  constraint users_contactable check (email is not null or phone is not null),
  constraint users_username_format check (username is null or username::text ~ '^[a-z0-9._-]{3,32}$')
);

create index users_village_id_idx on public.users (village_id);
-- Mirrors the uniqueness auth.users already enforces, so the two cannot drift.
create unique index users_email_key on public.users (email) where email is not null;

-- ---------------------------------------------------------------------------
-- permissions — the capability catalogue
-- ---------------------------------------------------------------------------

-- Global and not village-scoped: a capability such as `payments.verify` means the same thing
-- everywhere. What varies per village is *who holds it*, which is what user_roles and
-- user_permissions record. Seeded by migration; no policy below lets anyone but a super admin
-- write here.
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  resource text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  -- The dotted key is derived, not independently typed, so `key` and its parts cannot disagree.
  constraint permissions_key_parts check (key = resource || '.' || action),
  constraint permissions_key_format check (key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$')
);

-- ---------------------------------------------------------------------------
-- roles — named bundles of permissions
-- ---------------------------------------------------------------------------

-- `village_id IS NULL` is a system role, available to every village (the seven in
-- docs/PROJECT_PROPOSAL.md §4). A non-null `village_id` is a role a village defined for itself.
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  village_id uuid references public.villages (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  constraint roles_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  -- The two are the same fact stated twice; this stops them diverging.
  constraint roles_system_iff_global check (is_system = (village_id is null))
);

-- Two *partial* indexes, not one `unique (village_id, key)`. Postgres treats every NULL as
-- distinct, so a single constraint would happily accept `super_admin` twice at the system scope
-- — exactly the row that must never be duplicated.
create unique index roles_system_key_idx on public.roles (key) where village_id is null;
create unique index roles_village_key_idx on public.roles (village_id, key) where village_id is not null;

-- ---------------------------------------------------------------------------
-- role_permissions — what a role grants
-- ---------------------------------------------------------------------------

-- Not in the original request, and not optional: `roles` without this join is a list of labels
-- that authorises nothing.
create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- The PK already covers role_id-first lookups; this covers "who grants this permission?".
create index role_permissions_permission_id_idx on public.role_permissions (permission_id);

-- ---------------------------------------------------------------------------
-- user_roles — a role granted to a person, in a scope
-- ---------------------------------------------------------------------------

-- `village_id` here is the *scope of the grant*, which is not the same as `users.village_id`
-- (the person's home village). One person can be an owner in village A and an officer in
-- village B, and that is two rows. NULL means the grant is platform-wide, which in practice
-- only `super_admin` ever is.
--
-- A surrogate `id` primary key rather than the natural triple, because `village_id` is nullable
-- and a nullable column cannot sit in a primary key. Uniqueness comes from the partial indexes.
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  village_id uuid references public.villages (id) on delete cascade,
  granted_by uuid references public.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

create unique index user_roles_global_idx on public.user_roles (user_id, role_id) where village_id is null;
create unique index user_roles_scoped_idx on public.user_roles (user_id, role_id, village_id) where village_id is not null;
create index user_roles_village_id_idx on public.user_roles (village_id);
create index user_roles_role_id_idx on public.user_roles (role_id);

-- ---------------------------------------------------------------------------
-- user_permissions — direct grants layered over roles
-- ---------------------------------------------------------------------------

-- `effect = 'deny'` is what earns this table its place. Without it a direct grant is only a
-- shortcut for a one-permission role; with it, a village can revoke a single capability from
-- someone who still needs the rest of their role.
create table public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  village_id uuid references public.villages (id) on delete cascade,
  effect public.permission_effect not null default 'allow',
  granted_by uuid references public.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

create unique index user_permissions_global_idx on public.user_permissions (user_id, permission_id) where village_id is null;
create unique index user_permissions_scoped_idx on public.user_permissions (user_id, permission_id, village_id) where village_id is not null;
create index user_permissions_village_id_idx on public.user_permissions (village_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger villages_set_updated_at
  before update on public.villages
  for each row execute function public.set_updated_at();

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Every sign-up path — email/password, Google, and phone OTP when it lands — inserts into
-- auth.users. This is the only thing that gives the resulting account a profile, so without it
-- an OAuth user authenticates successfully into a row that does not exist.
--
-- `username` is deliberately NOT taken from sign-up metadata. A colliding username would raise
-- inside this trigger and abort the whole sign-up, turning a cosmetic conflict into a failed
-- registration; usernames are assigned afterwards instead.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, phone, full_name, avatar_url)
  values (
    new.id,
    nullif(new.email, '')::extensions.citext,
    nullif(new.phone, ''),
    -- Google returns `name`; an email sign-up can pass `full_name`. Neither is guaranteed.
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keeps the mirrored contact columns honest when a user changes their email or phone through
-- Supabase Auth. Without this the username -> email resolver would eventually sign people in
-- against an address they no longer own.
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set email = nullif(new.email, '')::extensions.citext,
      phone = nullif(new.phone, '')
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, phone on auth.users
  for each row execute function public.handle_auth_user_updated();

-- ---------------------------------------------------------------------------
-- Authorisation helpers
-- ---------------------------------------------------------------------------
--
-- Every one of these is SECURITY DEFINER, and that is load-bearing rather than lazy: the RLS
-- policy on `user_roles` calls a function that reads `user_roles`. Under SECURITY INVOKER that
-- read would re-evaluate the policy, which would call the function again, forever. A definer
-- function runs as the owner and skips RLS, which breaks the cycle.
--
-- `set search_path = ''` on each, with every identifier schema-qualified, so a caller cannot
-- shadow `public` or `auth` with a temp schema and change what these resolve to.

create or replace function public.is_super_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user
      and r.key = 'super_admin'
      and r.village_id is null
  );
$$;

-- Every village the user can see anything in: their home village, plus any village a role was
-- granted to them in.
create or replace function public.current_village_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.village_id
  from public.users u
  where u.id = p_user and u.village_id is not null
  union
  select ur.village_id
  from public.user_roles ur
  where ur.user_id = p_user and ur.village_id is not null;
$$;

-- Resolution order, and the reason this is a function rather than a join written out at each
-- call site:
--
--   1. A direct `deny` wins over everything, including super admin. A deny is an explicit act
--      by an administrator, and the whole point of it is that a broad grant does not undo it.
--   2. A direct `allow` wins over the absence of a role grant.
--   3. Super admin holds everything not explicitly denied.
--   4. Otherwise, the union of the user's role grants in scope.
--
-- A grant with `village_id IS NULL` applies in every scope; a scoped grant applies only in its
-- own village. When `p_village` is NULL the caller is asking about a platform-wide capability,
-- and `ur.village_id = p_village` is NULL rather than true, so only global grants match — which
-- is the intended reading, not an accident of three-valued logic.
create or replace function public.user_has_permission(
  p_permission text,
  p_village uuid default null,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with direct as (
    select up.effect
    from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = p_user
      and p.key = p_permission
      and (up.village_id is null or up.village_id = p_village)
  )
  select case
    when exists (select 1 from direct where effect = 'deny') then false
    when exists (select 1 from direct where effect = 'allow') then true
    when public.is_super_admin(p_user) then true
    else exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = p_user
        and p.key = p_permission
        and (ur.village_id is null or ur.village_id = p_village)
    )
  end;
$$;

-- "Village admin" is not a hardcoded role list — it is whoever holds `users.manage` in that
-- village. A village that invents its own custom role and gives it that permission gets the
-- same reach, with no change here.
create or replace function public.is_village_admin(
  p_village uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_village is not null
     and public.user_has_permission('users.manage', p_village, p_user);
$$;

-- `village_id` and `status` decide which tenant a person belongs to and whether they may sign
-- in at all. RLS is row-level and cannot stop a permitted row from having *those* columns
-- rewritten, so the guard is a trigger: without it, the "update your own row" policy below
-- would let any user move themselves into another village.
create or replace function public.users_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No JWT means the caller is not an end user: the service role, a migration, or a psql
  -- session as the table owner. All three already bypass RLS entirely and hold the service
  -- key, so there is nothing for this guard to protect against — and without this line the
  -- admin path that assigns a resident to a village is blocked along with the attack.
  -- `anon` also has a null uid, and reaches nothing here: the grants below revoke every
  -- privilege it has on this table.
  if auth.uid() is null then
    return new;
  end if;

  if new.village_id is distinct from old.village_id or new.status is distinct from old.status then
    if not (
      public.is_super_admin()
      or public.is_village_admin(old.village_id)
      or public.is_village_admin(new.village_id)
    ) then
      raise exception 'village_id and status may only be changed by a village or super admin'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger users_guard_privileged_columns
  before update on public.users
  for each row execute function public.users_guard_privileged_columns();

-- A village's own custom role must not be grantable outside that village.
create or replace function public.user_roles_guard_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_village uuid;
  v_is_system boolean;
  v_role_key text;
begin
  select r.village_id, r.is_system, r.key into v_role_village, v_is_system, v_role_key
  from public.roles r
  where r.id = new.role_id;

  if not v_is_system and v_role_village is distinct from new.village_id then
    raise exception 'a village-defined role may only be granted within its own village'
      using errcode = 'check_violation';
  end if;

  -- An unscoped grant applies in *every* village, because public.user_has_permission treats
  -- `ur.village_id IS NULL` as matching any scope. That is what `super_admin` is, and it is a
  -- silent tenancy hole for anything else: a NULL village on an `officer` grant hands that
  -- person payment verification in every village on the platform. Almost always it means the
  -- caller passed a village_id that turned out to be NULL, so this fails loudly instead.
  if new.village_id is null and v_role_key <> 'super_admin' then
    raise exception
      'role % must be granted within a village; only super_admin may be granted platform-wide',
      v_role_key
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger user_roles_guard_scope
  before insert or update on public.user_roles
  for each row execute function public.user_roles_guard_scope();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- Nothing here is reachable with the anon key. Sign-in happens against Supabase Auth, which
-- needs no table privileges at all, so an unauthenticated caller has no business reading any of
-- this. RLS alone would already return zero rows; revoking as well means a policy mistake later
-- cannot quietly open the door.

revoke all on public.villages, public.users, public.roles, public.permissions,
  public.role_permissions, public.user_roles, public.user_permissions from anon;

grant select on public.villages, public.users, public.roles, public.permissions,
  public.role_permissions, public.user_roles, public.user_permissions to authenticated;

grant insert, update, delete on public.villages, public.users, public.roles,
  public.permissions, public.role_permissions, public.user_roles,
  public.user_permissions to authenticated;

revoke all on function public.is_super_admin(uuid) from anon;
revoke all on function public.current_village_ids(uuid) from anon;
revoke all on function public.user_has_permission(text, uuid, uuid) from anon;
revoke all on function public.is_village_admin(uuid, uuid) from anon;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
--
-- `(select auth.uid())` rather than a bare `auth.uid()` throughout: the subquery form is
-- evaluated once as an InitPlan instead of once per candidate row, which is the difference
-- between an index scan and a sequential one on any table of size.

alter table public.villages enable row level security;
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_permissions enable row level security;

-- villages ------------------------------------------------------------------

create policy villages_select on public.villages
  for select to authenticated
  using (id in (select public.current_village_ids()) or public.is_super_admin());

create policy villages_write on public.villages
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- users ---------------------------------------------------------------------

-- The multi-tenancy boundary, and the single most important policy in the schema: a resident of
-- one village must not read another village's people even when the client asks for them.
create policy users_select on public.users
  for select to authenticated
  using (
    id = (select auth.uid())
    or (village_id is not null and village_id in (select public.current_village_ids()))
    or public.is_super_admin()
  );

create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy users_update_as_admin on public.users
  for update to authenticated
  using (public.is_village_admin(village_id) or public.is_super_admin())
  with check (public.is_village_admin(village_id) or public.is_super_admin());

-- Inviting a resident. The row is created ahead of the account, so `id` will not match an
-- auth.users row until they accept; the FK makes that impossible, which is why invitations go
-- through Supabase Auth's admin invite and land here via the sign-up trigger instead. This
-- policy exists for a super admin doing repair work.
create policy users_insert on public.users
  for insert to authenticated
  with check (public.is_super_admin());

-- No delete policy. A profile is removed by deleting the auth.users row it hangs off, which
-- cascades; deleting it here alone would leave an account that can sign in and has no identity.

-- permissions ---------------------------------------------------------------

create policy permissions_select on public.permissions
  for select to authenticated
  using (true);

create policy permissions_write on public.permissions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- roles ---------------------------------------------------------------------

-- The catalogue is readable by anyone signed in: a UI has to be able to name the role it is
-- about to show. Which roles a person *holds* is user_roles, and that is scoped below.
create policy roles_select on public.roles
  for select to authenticated
  using (true);

create policy roles_write on public.roles
  for all to authenticated
  using (
    public.is_super_admin()
    or (village_id is not null and public.is_village_admin(village_id))
  )
  with check (
    public.is_super_admin()
    or (village_id is not null and public.is_village_admin(village_id))
  );

-- role_permissions ----------------------------------------------------------

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (true);

-- A village admin may compose its own custom roles; only a super admin may change what a system
-- role means, since that would change it for every village at once.
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.roles r
      where r.id = role_id
        and r.village_id is not null
        and public.is_village_admin(r.village_id)
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.roles r
      where r.id = role_id
        and r.village_id is not null
        and public.is_village_admin(r.village_id)
    )
  );

-- user_roles ----------------------------------------------------------------

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_village_admin(village_id)
    or public.is_super_admin()
  );

-- The `super_admin` exclusion is a privilege-escalation guard, not tidiness: without it a
-- village admin — who may legitimately grant roles inside their own village — could grant
-- `super_admin` to themselves and leave the tenant boundary entirely.
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_village_admin(village_id)
      and not exists (
        select 1 from public.roles r where r.id = role_id and r.key = 'super_admin'
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.is_village_admin(village_id)
      and not exists (
        select 1 from public.roles r where r.id = role_id and r.key = 'super_admin'
      )
    )
  );

-- user_permissions ----------------------------------------------------------

create policy user_permissions_select on public.user_permissions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_village_admin(village_id)
    or public.is_super_admin()
  );

-- Scoped writes only. A village admin cannot create a platform-wide (`village_id IS NULL`)
-- grant, which would apply in every other village too.
create policy user_permissions_write on public.user_permissions
  for all to authenticated
  using (
    public.is_super_admin()
    or (village_id is not null and public.is_village_admin(village_id))
  )
  with check (
    public.is_super_admin()
    or (village_id is not null and public.is_village_admin(village_id))
  );
