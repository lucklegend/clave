-- The starting capability catalogue and the seven system roles from
-- docs/PROJECT_PROPOSAL.md §4.
--
-- Seeded by migration rather than by `supabase/seed.sql`, because these rows are schema, not
-- sample data: `public.is_village_admin` resolves through `users.manage`, and every RLS policy
-- that calls it returns false against an empty catalogue. A `db reset` that dropped these would
-- lock every non-super-admin out of their own village.
--
-- Idempotent throughout, so re-running against an existing database is a no-op rather than a
-- duplicate-key error.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (resource, action, key, description)
select resource, action, resource || '.' || action, description
from (values
  ('villages',      'read',    'See village records'),
  ('villages',      'manage',  'Create, rename and re-tier villages'),

  ('users',         'read',    'See the people in a village'),
  ('users',         'invite',  'Invite a new resident, officer or crew member'),
  -- The permission public.is_village_admin resolves through. Granting it makes someone an
  -- administrator of the village it is scoped to; nothing else confers that.
  ('users',         'manage',  'Change a person''s village, status, roles and permissions'),

  ('roles',         'read',    'See the role catalogue'),
  ('roles',         'manage',  'Define a village''s own roles and what they grant'),

  ('announcements', 'read',    'Read the announcement board'),
  ('announcements', 'create',  'Post an announcement'),
  ('announcements', 'update',  'Edit an announcement'),
  ('announcements', 'delete',  'Remove an announcement'),

  ('units',         'read',    'See units and their occupants'),
  ('units',         'manage',  'Create and reassign units'),

  ('payments',      'read',    'See payment records'),
  ('payments',      'submit',  'Upload a receipt against a charge'),
  ('payments',      'verify',  'Approve or reject a submitted receipt'),

  ('billing',       'read',    'See statements and the collection ledger'),
  ('billing',       'manage',  'Enter meter readings and run billing'),

  ('amenities',     'read',    'See amenities and their schedules'),
  ('amenities',     'manage',  'Create amenities and set their slot rules'),

  ('bookings',      'read',    'See amenity bookings'),
  ('bookings',      'create',  'Book an amenity'),
  ('bookings',      'cancel',  'Cancel a booking'),
  ('bookings',      'approve', 'Approve or reschedule a booking'),

  ('reports',       'read',    'See incident and maintenance reports'),
  ('reports',       'create',  'File a report'),
  ('reports',       'assign',  'Assign a report to crew or security'),
  ('reports',       'resolve', 'Mark a report resolved')
) as seed (resource, action, description)
on conflict (key) do update
  set description = excluded.description;

-- ---------------------------------------------------------------------------
-- System roles
-- ---------------------------------------------------------------------------

-- All seven are `village_id IS NULL` / `is_system = true`: they are available to every village,
-- and it is the *grant* in user_roles that carries the village, not the role itself.
insert into public.roles (key, name, description, is_system, village_id)
values
  ('super_admin',  'Super Admin',       'Platform operator. Provisions villages and subscriptions across every tenant.', true, null),
  ('hoa_admin',    'HOA Admin',         'Board member or property manager. Runs one village end to end.',                true, null),
  ('officer',      'Officer',           'Handles day-to-day operations: announcements, verification, approvals.',        true, null),
  ('owner',        'Owner',             'Owns the unit. Pays dues, books amenities, files reports.',                     true, null),
  ('tenant',       'Tenant',            'Rents the unit. As an owner, minus title-related actions.',                     true, null),
  ('maintenance',  'Maintenance Crew',  'Outside-hired staff. Receives and resolves maintenance reports.',               true, null),
  ('guard',        'Security Guard',    'Gate and patrol staff. Files and reads incident reports.',                      true, null)
on conflict (key) where village_id is null do update
  set name = excluded.name,
      description = excluded.description;

-- ---------------------------------------------------------------------------
-- What each role grants
-- ---------------------------------------------------------------------------

-- Super admin holds the whole catalogue. public.user_has_permission already short-circuits on
-- is_super_admin(), so these rows change no decision — they exist so that a "what can this role
-- do?" screen can answer honestly instead of showing an empty list for the most powerful role.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'super_admin' and r.village_id is null
on conflict do nothing;

-- Everyone else, named explicitly. The distinctions that matter:
--
--   * `users.manage` goes to hoa_admin and nobody else — it is what makes a village admin.
--     An officer runs the village's operations without being able to change who anyone is.
--   * `payments.verify` is the officer's job (manual receipt verification is the MVP payment
--     flow); `payments.submit` is the resident's.
--   * tenant is owner's grant list exactly, for now. They diverge when title-related actions
--     exist to withhold, and the two lists are written out separately so that divergence is a
--     one-line edit rather than a refactor.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('hoa_admin',   'villages.read'),
  ('hoa_admin',   'users.read'),
  ('hoa_admin',   'users.invite'),
  ('hoa_admin',   'users.manage'),
  ('hoa_admin',   'roles.read'),
  ('hoa_admin',   'roles.manage'),
  ('hoa_admin',   'announcements.read'),
  ('hoa_admin',   'announcements.create'),
  ('hoa_admin',   'announcements.update'),
  ('hoa_admin',   'announcements.delete'),
  ('hoa_admin',   'units.read'),
  ('hoa_admin',   'units.manage'),
  ('hoa_admin',   'payments.read'),
  ('hoa_admin',   'payments.verify'),
  ('hoa_admin',   'billing.read'),
  ('hoa_admin',   'billing.manage'),
  ('hoa_admin',   'amenities.read'),
  ('hoa_admin',   'amenities.manage'),
  ('hoa_admin',   'bookings.read'),
  ('hoa_admin',   'bookings.approve'),
  ('hoa_admin',   'bookings.cancel'),
  ('hoa_admin',   'reports.read'),
  ('hoa_admin',   'reports.assign'),
  ('hoa_admin',   'reports.resolve'),

  ('officer',     'villages.read'),
  ('officer',     'users.read'),
  ('officer',     'users.invite'),
  ('officer',     'roles.read'),
  ('officer',     'announcements.read'),
  ('officer',     'announcements.create'),
  ('officer',     'announcements.update'),
  ('officer',     'announcements.delete'),
  ('officer',     'units.read'),
  ('officer',     'payments.read'),
  ('officer',     'payments.verify'),
  ('officer',     'billing.read'),
  ('officer',     'billing.manage'),
  ('officer',     'amenities.read'),
  ('officer',     'amenities.manage'),
  ('officer',     'bookings.read'),
  ('officer',     'bookings.approve'),
  ('officer',     'bookings.cancel'),
  ('officer',     'reports.read'),
  ('officer',     'reports.assign'),
  ('officer',     'reports.resolve'),

  ('owner',       'announcements.read'),
  ('owner',       'units.read'),
  ('owner',       'payments.read'),
  ('owner',       'payments.submit'),
  ('owner',       'billing.read'),
  ('owner',       'amenities.read'),
  ('owner',       'bookings.read'),
  ('owner',       'bookings.create'),
  ('owner',       'bookings.cancel'),
  ('owner',       'reports.read'),
  ('owner',       'reports.create'),

  ('tenant',      'announcements.read'),
  ('tenant',      'units.read'),
  ('tenant',      'payments.read'),
  ('tenant',      'payments.submit'),
  ('tenant',      'billing.read'),
  ('tenant',      'amenities.read'),
  ('tenant',      'bookings.read'),
  ('tenant',      'bookings.create'),
  ('tenant',      'bookings.cancel'),
  ('tenant',      'reports.read'),
  ('tenant',      'reports.create'),

  ('maintenance', 'announcements.read'),
  ('maintenance', 'reports.read'),
  ('maintenance', 'reports.resolve'),

  ('guard',       'announcements.read'),
  ('guard',       'reports.read'),
  ('guard',       'reports.create')
) as seed (role_key, permission_key)
join public.roles r on r.key = seed.role_key and r.village_id is null
join public.permissions p on p.key = seed.permission_key
on conflict do nothing;
