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
