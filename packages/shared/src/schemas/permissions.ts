import { z } from "zod";

/**
 * The whole permission catalogue, seeded once in
 * `supabase/migrations/20260906120100_seed_roles_and_permissions.sql` and never migrated
 * again — a new capability is a new row in that seed's `values` block, plus a new member
 * here. `check-permission-keys.mjs`, beside this file, is what keeps the two from drifting;
 * nothing else reads both sides.
 *
 * Sorted alphabetically by `resource.action` rather than in the seed's role-story order, so
 * a key already in the list is one lookup rather than a document read.
 *
 * Defined once here, per `CLAUDE.md`'s rule that a domain shape belongs in one place and is
 * imported by both apps: `apps/web`'s portal shell hides a nav destination it lacks the key
 * for, and `apps/mobile` will gate on `payments.submit` and `bookings.create` the same way.
 */
export const permissionKeySchema = z.enum([
  "amenities.manage",
  "amenities.read",
  "announcements.create",
  "announcements.delete",
  "announcements.read",
  "announcements.update",
  "billing.manage",
  "billing.read",
  "bookings.approve",
  "bookings.cancel",
  "bookings.create",
  "bookings.read",
  "payments.read",
  "payments.submit",
  "payments.verify",
  "reports.assign",
  "reports.create",
  "reports.read",
  "reports.resolve",
  "roles.manage",
  "roles.read",
  "units.manage",
  "units.read",
  "users.invite",
  "users.manage",
  "users.read",
  "villages.manage",
  "villages.read",
]);

export type PermissionKey = z.infer<typeof permissionKeySchema>;

/** The same 28 keys as a plain array, for callers that want to iterate rather than parse. */
export const PERMISSION_KEYS = permissionKeySchema.options;
