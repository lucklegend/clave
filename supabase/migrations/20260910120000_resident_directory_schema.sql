-- ---------------------------------------------------------------------------
-- Residents directory — the schema half (ticket 0014)
--
-- Two additions, no new table:
--
--   1. Five address columns on `public.users`, because a village roster that
--      cannot say where somebody lives is not a roster. They are a deliberate
--      stand-in until `units` exists — see the column comments.
--   2. `public.resident_role`, the label vocabulary the board's filter tabs are
--      drawn from.
--
-- The functions that read all this live in the migration beside this one. They
-- are `security definer` and therefore have their own argument to make; keeping
-- them apart means this file can be read as "what is stored" and that one as
-- "who may see it".
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Address
-- ---------------------------------------------------------------------------

-- Every part is nullable, and that is the shape of the problem rather than
-- laziness: a subdivision house is Phase/Block/Lot/Street and has no room, a
-- condo unit is a room and has no lot, and an account created by phone OTP on
-- mobile may have none of it yet. "We do not know" is a real answer here, so
-- there is no default and no NOT NULL.
alter table public.users
  add column address_room text,
  add column address_block text,
  add column address_lot text,
  add column address_street text,
  add column address_phase text;

comment on column public.users.address_room is
  'Room or unit number. Nullable stand-in until the units table exists (ticket 0014); these five columns migrate into it.';
comment on column public.users.address_block is
  'Block. Nullable stand-in until the units table exists (ticket 0014).';
comment on column public.users.address_lot is
  'Lot. Nullable stand-in until the units table exists (ticket 0014).';
comment on column public.users.address_street is
  'Street name. Nullable stand-in until the units table exists (ticket 0014).';
comment on column public.users.address_phase is
  'Phase. Nullable stand-in until the units table exists (ticket 0014).';

-- Named one per column rather than one combined check, so a violation names the
-- field the form has to draw the error on.
--
-- `btrim(x) = x` is the load-bearing half. The board renders these five into a
-- single line with separators between them, and a value carrying leading
-- whitespace would render as a gap nobody can see in the input box. The length
-- caps mirror into Zod's `.max()` the way `announcements_title_length` mirrors
-- into `announcementDraftSchema` — the constraint is the enforcement and Zod
-- turns it into a sentence, never the other way round.
--
-- Without the caps, a one-megabyte "room number" renders into every page of the
-- table. React escapes it, so it is not an injection; it is still a denial of a
-- readable page.
alter table public.users
  add constraint users_address_room_format
    check (address_room is null
           or (btrim(address_room) = address_room and length(address_room) between 1 and 32)),
  add constraint users_address_block_format
    check (address_block is null
           or (btrim(address_block) = address_block and length(address_block) between 1 and 32)),
  add constraint users_address_lot_format
    check (address_lot is null
           or (btrim(address_lot) = address_lot and length(address_lot) between 1 and 32)),
  add constraint users_address_street_format
    check (address_street is null
           or (btrim(address_street) = address_street and length(address_street) between 1 and 120)),
  add constraint users_address_phase_format
    check (address_phase is null
           or (btrim(address_phase) = address_phase and length(address_phase) between 1 and 32));

-- The board orders by name within a village. This backs that ordering; it does
-- not make the list an index scan, because the role tab filters on a value
-- derived from a join and the planner will sort anyway until a village has
-- thousands of members. Cheap and correct, and claimed as nothing more.
create index users_village_name_idx on public.users (village_id, full_name, id);

-- ---------------------------------------------------------------------------
-- The label vocabulary
-- ---------------------------------------------------------------------------

-- Declared in the order the tabs are drawn, on purpose. The generated
-- `Constants.public.Enums.resident_role` in `packages/shared/src/types/database.ts`
-- then hands the Zod schema the exact tuple in display order, so
-- `z.enum(Constants.public.Enums.resident_role)` cannot drift from the database.
-- That is the same drift problem `permissionKeySchema` needs a checking script
-- for, solved here for free because this side of it is generated rather than
-- hand-written.
--
-- **These are labels, not roles.** `public.roles.key` is the grant vocabulary
-- and it has seven members including `super_admin`; this has five and folds
-- `hoa_admin` and `officer` together into `admin`. Keeping them as two distinct
-- types is what stops a display grouping being mistaken for something a grant
-- could be written against.
create type public.resident_role as enum ('admin', 'crew', 'guard', 'owner', 'tenant');

comment on type public.resident_role is
  'Display grouping for the residents board tabs. hoa_admin and officer both map to admin; super_admin has no member and never appears on a village roster.';
