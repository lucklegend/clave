-- The announcement board: the table, its attachments, and the first Storage bucket in
-- this repository.
--
-- One migration rather than three, for the reason 20260906120000 gives: CLAUDE.md requires
-- a village-scoped table to ship its RLS policy in the migration that creates it, and the
-- same argument covers the bucket. A bucket with no `storage.objects` policy is not
-- "locked down" — it is unfinished, and the file is the half of an attachment that RLS on
-- the table does not reach.
--
-- Order inside the file: enums -> tables -> triggers -> grants -> policies -> storage.
--
-- Two things here are firsts for this schema and are called out again where they happen:
--
--   * These are the first RLS policies keyed on a capability other than `users.manage`.
--     Everything to date gates through `public.is_village_admin`, which resolves that one
--     key. These ask `public.user_has_permission` for the announcement keys directly,
--     which is what the `is_village_admin` comment in 20260906120000 always implied was
--     possible ("not a hardcoded role list") and what CLAUDE.md reserves that function
--     for: a single guard at a mutation boundary.
--
--   * `created_by` is the first authorship column in the schema. See the note on it below
--     for why it is nullable, which is not an oversight.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
--
-- Three values, and deliberately no `scheduled`. Intent is the enum; time is the column.
-- A post that is going out is `published` and carries a `publish_at`, and it becomes
-- visible to residents when that instant passes — a comparison the SELECT policy makes on
-- every read.
--
-- "Scheduled" is therefore derived, never stored: `status = 'published' and publish_at >
-- now()`. That is the whole scheduling mechanism. There is no cron job, no edge function
-- and no row waiting to be flipped, so there is nothing that can fail at 6am and leave a
-- post that quietly never went out. A derived label also cannot disagree with what
-- residents actually see, because both come from the same comparison.

create type public.announcement_status as enum ('draft', 'published', 'archived');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete cascade,
  title text not null,
  body text not null,
  status public.announcement_status not null default 'draft',
  publish_at timestamptz,

  -- Nullable, and `on delete set null` rather than `not null`, because `public.users`
  -- cascades from `auth.users`. A NOT NULL creator would force one of two worse
  -- outcomes when an account is deleted: either the delete is blocked, or the village's
  -- announcement history goes with the person who wrote it. Neither is acceptable for a
  -- board that is the village's record of what it was told. The list falls back to
  -- "Removed account".
  created_by uuid references public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint announcements_title_length check (char_length(title) between 1 and 200),
  constraint announcements_body_length check (char_length(body) between 1 and 20000),

  -- A published row must say when; a draft must not. A publish time on a draft is a
  -- schedule nobody armed, and it would read as pending in a list that is sorted by it.
  -- Written as an equality between two booleans so both directions are one constraint.
  constraint announcements_publish_at_iff_published
    check ((status = 'published') = (publish_at is not null)),

  -- The composite target the attachment foreign key below points at. Redundant as a
  -- uniqueness claim — `id` is already the primary key — and load-bearing as a reference
  -- target: it is what lets a child row be checked against its parent's village.
  constraint announcements_id_village_key unique (id, village_id)
);

create index announcements_village_id_idx on public.announcements (village_id);

-- The list order: drafts first (no publish time), then everything else newest first. The
-- index carries `nulls first` so the query that draws the board can be an index scan
-- rather than a sort.
create index announcements_village_publish_idx
  on public.announcements (village_id, publish_at desc nulls first, created_at desc);

-- A child table rather than the singular `attachment_url` that docs/TECH_STACK.md's data
-- model sketched. The sketch predates the requirement for several files of mixed type per
-- post; a JSON column would have carried the same rows with none of the constraints, and
-- Storage paths that nothing could enforce.
create table public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null,

  -- Denormalised from the parent on purpose. Both the RLS policy and the Storage object
  -- path are keyed on the village, and neither should need a join to find it.
  village_id uuid not null references public.villages(id) on delete cascade,

  -- `<village_id>/<announcement_id>/<uuid>.<ext>`. Unique because two rows pointing at
  -- one object would let deleting either take the file from under the other.
  storage_path text not null unique,

  -- The name the person uploaded, sanitised, for display and for the download filename.
  -- It never appears in `storage_path`: the stored object is always a generated UUID, so
  -- a hostile filename cannot reach a path.
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  checksum_sha256 text not null,

  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint announcement_attachments_byte_size_positive check (byte_size > 0),
  constraint announcement_attachments_file_name_length
    check (char_length(file_name) between 1 and 255),
  constraint announcement_attachments_checksum_format
    check (checksum_sha256 ~ '^[0-9a-f]{64}$'),

  -- Composite, so a child's `village_id` cannot drift from its parent's. A plain foreign
  -- key on `announcement_id` alone would let a row name any village it liked, and both
  -- the policy below and the object path trust that column.
  constraint announcement_attachments_parent_fkey
    foreign key (announcement_id, village_id)
    references public.announcements (id, village_id) on delete cascade
);

create index announcement_attachments_announcement_id_idx
  on public.announcement_attachments (announcement_id);

create index announcement_attachments_village_id_idx
  on public.announcement_attachments (village_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- An RLS `with check` cannot see OLD, so the INSERT policy can pin the creator to the
-- caller but nothing stops an UPDATE rewriting it afterwards. Authorship that can be
-- edited by whoever can edit the post is not authorship.
--
-- Same shape as `public.users_guard_privileged_columns`, including the `auth.uid() is
-- null` escape: no JWT means the caller is not an end user — a migration, the service
-- role, or psql as the owner — and those must be able to backfill.
create or replace function public.announcements_guard_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is set once, when the announcement is created'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger announcements_guard_created_by
  before update on public.announcements
  for each row execute function public.announcements_guard_created_by();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- Nothing here is reachable with the anon key. A resident reads the board through an
-- authenticated session; there is no public announcement feed, and if one is ever wanted
-- it should be a deliberate second surface rather than a side effect of a grant left open.
--
-- This migration adds no new SQL function reachable over PostgREST — the guard above
-- returns `trigger`, which Postgres refuses to call directly — so the `revoke ... from
-- public` trap that 20260908130000 documents does not arise here. If a function is added
-- later it must be `revoke ... from public, anon` and revoke before grant.

revoke all on public.announcements, public.announcement_attachments from anon;

grant select, insert, update, delete
  on public.announcements, public.announcement_attachments
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
--
-- `(select auth.uid())` rather than a bare `auth.uid()` throughout, as in
-- 20260906120000: the subquery form is evaluated once as an InitPlan instead of once per
-- candidate row.

alter table public.announcements enable row level security;
alter table public.announcement_attachments enable row level security;

-- announcements ---------------------------------------------------------------
--
-- Two audiences, one policy. Somebody who can post (`announcements.create`) sees
-- everything in the village, drafts included, because the board is their workspace.
-- Everybody else sees a row only once it is published *and* its publish time has passed.
--
-- That second clause is the scheduling mechanism, and it lives here rather than in a
-- query on purpose: a resident who asks PostgREST directly, with the anon key that ships
-- in the browser bundle, gets the same answer as the portal gives them. A filter in the
-- client would have been a convenience that looked like a control.
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      village_id in (select public.current_village_ids())
      and public.user_has_permission('announcements.read', village_id)
      and (
        public.user_has_permission('announcements.create', village_id)
        or (status = 'published' and publish_at <= now())
      )
    )
  );

-- `created_by = auth.uid()` is part of the check, not a default to be trusted: a column
-- default is only applied when the column is omitted, and a client that sends one can
-- send anybody's id. Together with the guard trigger above, authorship is now true on
-- insert and unchanged thereafter.
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (
    village_id in (select public.current_village_ids())
    and public.user_has_permission('announcements.create', village_id)
    and created_by = (select auth.uid())
  );

-- `using` and `with check` are both stated, and both name the same village column. Only
-- `using` would let a row be updated out of the village it is currently in and into one
-- the caller has no rights over.
create policy announcements_update on public.announcements
  for update to authenticated
  using (
    public.is_super_admin()
    or (
      village_id in (select public.current_village_ids())
      and public.user_has_permission('announcements.update', village_id)
    )
  )
  with check (
    public.is_super_admin()
    or (
      village_id in (select public.current_village_ids())
      and public.user_has_permission('announcements.update', village_id)
    )
  );

create policy announcements_delete on public.announcements
  for delete to authenticated
  using (
    public.is_super_admin()
    or (
      village_id in (select public.current_village_ids())
      and public.user_has_permission('announcements.delete', village_id)
    )
  );

-- announcement_attachments ----------------------------------------------------
--
-- Visibility is delegated rather than restated. The subquery runs under the caller's own
-- RLS, so an attachment is visible exactly when its announcement is — including the
-- publish-time rule — and that rule is written in one place. Restating it here would be
-- two copies of a tenancy boundary that have to be kept in step by hand.
create policy announcement_attachments_select on public.announcement_attachments
  for select to authenticated
  using (
    exists (
      select 1
      from public.announcements a
      where a.id = announcement_id
    )
  );

create policy announcement_attachments_write on public.announcement_attachments
  for all to authenticated
  using (
    public.is_super_admin()
    or (
      village_id in (select public.current_village_ids())
      and (
        public.user_has_permission('announcements.create', village_id)
        or public.user_has_permission('announcements.update', village_id)
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      village_id in (select public.current_village_ids())
      and (
        public.user_has_permission('announcements.create', village_id)
        or public.user_has_permission('announcements.update', village_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
--
-- The first bucket in this repository, so the shape below is the precedent for the
-- payment receipts in ticket 0006 and everything after.
--
-- Private, and never `public = true`. A public bucket serves every object to anyone who
-- can guess or is given the URL, with no session and no policy — which for a
-- multi-tenant product is a tenancy breach with a friendly interface. Files are handed
-- out as short-lived signed URLs minted per request instead.
--
-- `file_size_limit` and `allowed_mime_types` are enforced by Storage itself, after the
-- application has already checked both. That duplication is deliberate: the application
-- check produces a message a person can act on, and this one is what holds if a future
-- caller forgets to run it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-attachments',
  'announcement-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/heic'
  ]
)
on conflict (id) do nothing;

-- Objects are named `<village_id>/<announcement_id>/<uuid>.<ext>`, so the tenant is the
-- first path segment and a policy can reach it without a join.
--
-- Read is delegated to the attachment row, exactly as the table policy above delegates to
-- the announcement: the object is readable when a row naming it is readable, and the
-- publish-time rule reaches the file through both hops without being written a third
-- time.
create policy announcement_attachments_object_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'announcement-attachments'
    and exists (
      select 1
      from public.announcement_attachments a
      where a.storage_path = storage.objects.name
    )
  );

-- Write cannot delegate the same way, because the bytes are uploaded after the row exists
-- but the row is what the read policy checks — so this one reads the path itself.
--
-- The comparison is `villages.id::text = <segment>` and never `<segment>::uuid`. Casting
-- an arbitrary path segment to uuid raises `22P02` on a malformed one, which turns a
-- request that should simply be refused into an error; comparing in the other direction
-- just yields false.
create policy announcement_attachments_object_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'announcement-attachments'
    and exists (
      select 1
      from public.villages v
      where v.id::text = (storage.foldername(name))[1]
        and public.user_has_permission('announcements.create', v.id)
    )
  );

create policy announcement_attachments_object_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'announcement-attachments'
    and exists (
      select 1
      from public.villages v
      where v.id::text = (storage.foldername(name))[1]
        and (
          public.user_has_permission('announcements.update', v.id)
          or public.user_has_permission('announcements.delete', v.id)
        )
    )
  );

-- No UPDATE policy on the objects. An attachment is replaced by uploading a new one and
-- deleting the old row, which keeps the checksum and the byte size in the database
-- honest; overwriting an object in place would leave both describing bytes that are no
-- longer there.
