import { permissionKeySchema } from "@clavehq/shared";
import type { PermissionKey } from "@clavehq/shared";
import type { PermissionSet } from "./types";

/**
 * The pure half of the authz seam: the questions a rendered page asks of a permission set, and
 * the parse that builds one.
 *
 * No I/O and deliberately no `import "server-only"`. A `PermissionSet` resolved on the server is
 * passed down as a prop, and the mobile drawer that receives it is a client component asking the
 * same questions — it should ask them with these functions rather than reach into the set.
 */

/** Whether the caller holds `key` in the village the set was resolved for. */
export function can(permissions: PermissionSet, key: PermissionKey): boolean {
  return permissions.has(key);
}

/** Whether the caller holds at least one of `keys`. An empty list is not a match. */
export function canAny(permissions: PermissionSet, keys: readonly PermissionKey[]): boolean {
  return keys.some((key) => permissions.has(key));
}

/**
 * Whether the caller holds every one of `keys`.
 *
 * An empty list passes, as `every` does. That is the mathematically correct answer and still a
 * trap: a gate whose key list is built dynamically and comes out empty opens rather than closes.
 * Gate on a `PermissionKey` with `can` wherever there is only one key to check.
 */
export function canAll(permissions: PermissionSet, keys: readonly PermissionKey[]): boolean {
  return keys.every((key) => permissions.has(key));
}

/**
 * The RPC's `string[]` as a `PermissionSet`, **by parsing each key, not by asserting the array**.
 *
 * The database can legitimately return a key this build has never heard of: a migration adding a
 * capability can land ahead of a `gen types` run, or ahead of the enum in
 * `packages/shared/src/schemas/permissions.ts`. Casting the array to `PermissionKey[]` would
 * launder that key into the type system, where it would compare equal to nothing and gate a
 * destination that silently never appears — with the type checker asserting the whole time that
 * the value is one of the 28. Parsing drops it at the boundary instead, which is the same
 * outcome for the user and a visible one for anyone who looks: the key is absent from the set,
 * not hiding inside it under a type it does not have.
 *
 * The drift checker (`pnpm --filter shared check:permissions`) is what stops that from being
 * discovered by a missing nav row.
 */
export function toPermissionSet(keys: readonly string[]): PermissionSet {
  const permissions = new Set<PermissionKey>();

  for (const key of keys) {
    const parsed = permissionKeySchema.safeParse(key);

    if (parsed.success) {
      permissions.add(parsed.data);
    }
  }

  return permissions;
}
