-- Local development seed. Runs on `supabase db reset`, after the migrations.
--
-- Sample data only — nothing here is required for the app to work, and none of it should ever
-- reach a deployed database. The capability catalogue and the seven system roles are *not*
-- seeded here: they are schema, and they live in
-- `migrations/20260906120100_seed_roles_and_permissions.sql` so a real database has them too.

-- ---------------------------------------------------------------------------
-- Villages
-- ---------------------------------------------------------------------------

-- Two, because one tenant cannot demonstrate tenant isolation. Signed in as a member of Villa
-- Alpha, `select * from public.users` must return no Villa Bravo row.
insert into public.villages (name, slug, tier)
values
  ('Villa Alpha', 'villa-alpha', 'tier_1'),
  ('Villa Bravo', 'villa-bravo', 'free')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Development account
-- ---------------------------------------------------------------------------
--
--   username  alpha_admin        (or the email below — the form takes either)
--   email     admin@villa-alpha.test
--   password  clavehq-test-1
--   role      HOA Admin of Villa Alpha
--
-- LOCAL ONLY. The password is in version control, which is the entire point of a dev seed and
-- exactly why this must never run anywhere but a local stack.
--
-- Writing `auth.users` by hand is normally the wrong move — it means reproducing GoTrue's own
-- bookkeeping, and the two can drift when Supabase updates. It is done here anyway because the
-- alternative is an account that vanishes on every `db reset`, and the shape below was copied
-- from a row GoTrue actually created rather than guessed:
--
--   * the password is bcrypt via `extensions.crypt`, which is the hash GoTrue verifies against;
--   * `auth.identities` needs a matching row or email sign-in is refused even with a correct
--     password — that table, not `auth.users`, is what records "this account has an email
--     credential";
--   * for the email provider GoTrue sets `provider_id` to the user's own id as text;
--   * `email_confirmed_at` must be set or sign-in is refused as unconfirmed;
--   * the four token columns must be `''`, never NULL. They have no database default, and
--     GoTrue scans them into Go strings that cannot hold NULL — leaving them out produces
--     `{"code":500,"error_code":"unexpected_failure","msg":"Database error querying schema"}`
--     at sign-in, which names neither the table nor the column and is otherwise a long hunt.
--
-- `public.users` is deliberately not inserted here: the `handle_new_user` trigger creates it
-- from the `auth.users` row, so this seed exercises that trigger rather than working around it.
--
-- If a Supabase upgrade ever breaks this block, `db reset` fails loudly and the fix is to
-- create the account through the API instead:
--
--   curl -X POST http://127.0.0.1:54321/auth/v1/admin/users \
--     -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{"email":"you@example.com","password":"clavehq-test-1","email_confirm":true}'

-- A fixed id rather than `gen_random_uuid()`, so re-running this file is idempotent and so the
-- id is stable across resets when you need to reference it by hand.
insert into auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-a000-00000000ad11',
  'authenticated',
  'authenticated',
  'admin@villa-alpha.test',
  extensions.crypt('clavehq-test-1', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "Alpha Administrator"}'::jsonb,
  '', '', '', '',
  now(),
  now()
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values (
  '00000000-0000-4000-a000-00000000ad11',
  '00000000-0000-4000-a000-00000000ad11',
  jsonb_build_object(
    'sub', '00000000-0000-4000-a000-00000000ad11',
    'email', 'admin@villa-alpha.test',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do nothing;

-- Everything below acts on the `public.users` row the trigger just created.
update public.users
set village_id = (select id from public.villages where slug = 'villa-alpha'),
    username = 'alpha_admin'
where id = '00000000-0000-4000-a000-00000000ad11';

-- HOA Admin, scoped to Villa Alpha. That role holds `users.manage`, which is what
-- `public.is_village_admin` resolves through — so this account can administer Villa Alpha and
-- nothing outside it.
insert into public.user_roles (user_id, role_id, village_id)
select u.id, r.id, u.village_id
from public.users u, public.roles r
where u.id = '00000000-0000-4000-a000-00000000ad11'
  and r.key = 'hoa_admin'
  and r.village_id is null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Resident accounts
-- ---------------------------------------------------------------------------
--
--   username  alpha_owner        email owner@villa-alpha.test   Owner of Villa Alpha
--   username  bravo_owner        email owner@villa-bravo.test   Owner of Villa Bravo
--   password  clavehq-test-1     (both)
--
-- Added by ticket 0010. Until now this seed had exactly one account, an HOA Admin, which
-- meant every resident-facing path in the product was unexercised — ticket 0007 recorded
-- the same gap for the portal's three fallback screens and could not close it.
--
-- Two of them, in different villages, because they answer different questions. The Villa
-- Alpha owner is the audience test: they hold `announcements.read` and not
-- `announcements.create`, so they must see published posts whose time has passed and must
-- not see drafts or scheduled ones. The Villa Bravo owner is the tenancy test: they must
-- see nothing of Villa Alpha at all, whatever they ask for.
--
-- Written set-based rather than as two copies of the block above. The bookkeeping GoTrue
-- needs is documented there and is identical for every account; repeating it three times
-- is three places to fix when Supabase changes it.

insert into auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  seed.id,
  'authenticated',
  'authenticated',
  seed.email,
  extensions.crypt('clavehq-test-1', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', seed.full_name),
  '', '', '', '',
  now(),
  now()
from (values
  ('00000000-0000-4000-a000-00000000a011'::uuid, 'owner@villa-alpha.test', 'Alpha Owner', 'alpha_owner', 'villa-alpha'),
  ('00000000-0000-4000-a000-00000000b011'::uuid, 'owner@villa-bravo.test', 'Bravo Owner', 'bravo_owner', 'villa-bravo')
) as seed (id, email, full_name, username, village_slug)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  seed.id::text,
  seed.id,
  jsonb_build_object(
    'sub', seed.id::text,
    'email', seed.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from (values
  ('00000000-0000-4000-a000-00000000a011'::uuid, 'owner@villa-alpha.test'),
  ('00000000-0000-4000-a000-00000000b011'::uuid, 'owner@villa-bravo.test')
) as seed (id, email)
on conflict (provider_id, provider) do nothing;

update public.users u
set village_id = v.id,
    username = seed.username
from (values
  ('00000000-0000-4000-a000-00000000a011'::uuid, 'alpha_owner', 'villa-alpha'),
  ('00000000-0000-4000-a000-00000000b011'::uuid, 'bravo_owner', 'villa-bravo')
) as seed (id, username, village_slug)
join public.villages v on v.slug = seed.village_slug
where u.id = seed.id;

-- Scoped to their own village, which is the whole point: `owner` holds
-- `announcements.read` and nothing that lets them post.
insert into public.user_roles (user_id, role_id, village_id)
select u.id, r.id, u.village_id
from public.users u, public.roles r
where u.id in (
    '00000000-0000-4000-a000-00000000a011',
    '00000000-0000-4000-a000-00000000b011'
  )
  and r.key = 'owner'
  and r.village_id is null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Directory fixture — one account per residents tab
-- ---------------------------------------------------------------------------
--
--   username  alpha_officer   email officer@villa-alpha.test   Officer      → Admin tab
--   username  alpha_crew      email crew@villa-alpha.test      Maintenance  → Crew tab
--   username  alpha_guard     email guard@villa-alpha.test     Guard        → Guard tab
--   username  alpha_tenant    email tenant@villa-alpha.test    Tenant       → Tenant tab
--   username  alpha_invited   email invited@villa-alpha.test   no role      → All only
--   password  clavehq-test-1  (all of them)
--
-- Added by ticket 0014. Two reasons, and the first is not about filling tabs.
--
-- **The officer is the account the whole `security definer` read path exists for.** An
-- officer holds `users.read` but not `users.manage`, so `user_roles_select` shows them
-- exactly their own grant and nothing else — under plain RLS the directory's Role column
-- and every filter tab would be blank for them. Until now this seed had no officer at all,
-- so that path could not be exercised even in principle, and a change that broke it would
-- have looked green. `public.residents_list` is what fixes it and this account is what
-- proves it.
--
-- `alpha_invited` carries `status = 'invited'` and deliberately **no role grant**: that is
-- the state a person sits in between being invited and an admin assigning them a role, so
-- `role_key` comes back null and the row must still appear under All. A directory that
-- dropped them would lose people in exactly the window where somebody is looking for them.
--
-- Addresses are spread across the five parts on purpose — a condo room with no lot, a
-- subdivision block/lot with no room — so `formatResidentAddress` is exercised against the
-- shapes it actually has to survive rather than against one tidy example.

insert into auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  seed.id,
  'authenticated',
  'authenticated',
  seed.email,
  extensions.crypt('clavehq-test-1', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', seed.full_name),
  '', '', '', '',
  now(),
  now()
from (values
  ('00000000-0000-4000-a000-00000000a021'::uuid, 'officer@villa-alpha.test', 'Alpha Officer'),
  ('00000000-0000-4000-a000-00000000a031'::uuid, 'crew@villa-alpha.test',    'Alpha Crew'),
  ('00000000-0000-4000-a000-00000000a041'::uuid, 'guard@villa-alpha.test',   'Alpha Guard'),
  ('00000000-0000-4000-a000-00000000a051'::uuid, 'tenant@villa-alpha.test',  'Alpha Tenant'),
  ('00000000-0000-4000-a000-00000000a061'::uuid, 'invited@villa-alpha.test', 'Alpha Invited')
) as seed (id, email, full_name)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  seed.id::text,
  seed.id,
  jsonb_build_object(
    'sub', seed.id::text,
    'email', seed.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from (values
  ('00000000-0000-4000-a000-00000000a021'::uuid, 'officer@villa-alpha.test'),
  ('00000000-0000-4000-a000-00000000a031'::uuid, 'crew@villa-alpha.test'),
  ('00000000-0000-4000-a000-00000000a041'::uuid, 'guard@villa-alpha.test'),
  ('00000000-0000-4000-a000-00000000a051'::uuid, 'tenant@villa-alpha.test'),
  ('00000000-0000-4000-a000-00000000a061'::uuid, 'invited@villa-alpha.test')
) as seed (id, email)
on conflict (provider_id, provider) do nothing;

update public.users u
set village_id = v.id,
    username = seed.username,
    status = seed.status,
    phone = seed.phone,
    address_room = seed.address_room,
    address_block = seed.address_block,
    address_lot = seed.address_lot,
    address_street = seed.address_street,
    address_phase = seed.address_phase
from (values
  ('00000000-0000-4000-a000-00000000a021'::uuid, 'alpha_officer', 'active'::public.user_status,
   '+639170000021', null, '3', '14', 'Narra Street', '1'),
  ('00000000-0000-4000-a000-00000000a031'::uuid, 'alpha_crew', 'active'::public.user_status,
   '+639170000031', null, null, null, 'Service Road', '2'),
  ('00000000-0000-4000-a000-00000000a041'::uuid, 'alpha_guard', 'active'::public.user_status,
   '+639170000041', null, null, null, 'Gate 1', null),
  ('00000000-0000-4000-a000-00000000a051'::uuid, 'alpha_tenant', 'active'::public.user_status,
   '+639170000051', '12B', null, null, 'Acacia Tower', '2'),
  ('00000000-0000-4000-a000-00000000a061'::uuid, 'alpha_invited', 'invited'::public.user_status,
   null, null, '7', '3', 'Molave Street', '3')
) as seed (id, username, status, phone, address_room, address_block, address_lot, address_street, address_phase)
join public.villages v on v.slug = 'villa-alpha'
where u.id = seed.id;

-- Each scoped to Villa Alpha. `alpha_invited` is absent from this list on purpose — see
-- the note above about the null-role state.
insert into public.user_roles (user_id, role_id, village_id)
select seed.id, r.id, u.village_id
from (values
  ('00000000-0000-4000-a000-00000000a021'::uuid, 'officer'),
  ('00000000-0000-4000-a000-00000000a031'::uuid, 'maintenance'),
  ('00000000-0000-4000-a000-00000000a041'::uuid, 'guard'),
  ('00000000-0000-4000-a000-00000000a051'::uuid, 'tenant')
) as seed (id, role_key)
join public.users u on u.id = seed.id
join public.roles r on r.key = seed.role_key and r.village_id is null
on conflict do nothing;
