import type { PermissionKey } from "@clavehq/shared";
import type { Tables } from "@clavehq/shared/types/database";

/**
 * A village as the portal chrome needs it: enough to label the switcher pill and to scope the
 * capability lookup, and nothing more.
 *
 * Derived from the generated row type rather than re-declared, so a column that changes shape in
 * a migration reaches this through the next `gen types` run instead of drifting quietly.
 */
export type Village = Pick<Tables<"villages">, "id" | "name" | "slug" | "tier">;

/**
 * Every capability the caller holds *in one village*. Read-only because it is resolved once per
 * request and then passed down through the shell as a prop — a component that could add to it
 * could grant itself a destination.
 *
 * `PermissionKey` and not `string`: a set of arbitrary strings answers every question with
 * "no" and never says why. See `toPermissionSet` in `permissions.ts` for what happens to a key
 * the database knows and this build does not.
 */
export type PermissionSet = ReadonlySet<PermissionKey>;

/**
 * Who is asking, where they are asking from, and what they may do there — resolved once per
 * request by `server/context.ts` and the only thing the shell should authorise against.
 *
 * `village` is one of `villages`, by identity, not a copy of it: the pill highlights the current
 * entry in the switcher list, and two structurally-equal-but-separate objects would make that a
 * comparison of fields instead of a comparison of references.
 */
export type AuthzContext = {
  userId: string;
  /** Every village the caller may read, ordered by name. A super admin sees the whole platform. */
  villages: readonly Village[];
  /** The village `permissions` was resolved for. Server-chosen; see `server/context.ts`. */
  village: Village;
  permissions: PermissionSet;
};

/**
 * The five answers a portal route can get, as a discriminated union rather than a context plus a
 * scattering of nullable fields — every one of the four failures renders differently, and a
 * caller that has narrowed to `"ok"` cannot then read a village that is not there.
 *
 * The distinction that matters most is `"no-access"` against `"unavailable"`. An empty permission
 * set is a legitimate answer — a resident whose village has not given them a role yet — and a
 * failed read is not, but the two arrive as the same empty list if nothing keeps them apart.
 * Collapsing them renders a database outage as "you have no permissions", which is wrong in the
 * quietest possible way: it looks like a correctly drawn page.
 */
export type AuthzResult =
  /** Signed in, scoped to a village, and holding at least one capability there. */
  | { status: "ok"; context: AuthzContext }
  /** No session. `src/proxy.ts` normally catches this first; a page still checks for itself. */
  | { status: "signed-out" }
  /** Signed in, but RLS returns no village — no home village and no grant scoped to one. */
  | { status: "no-villages" }
  /** Signed in and in a village, holding nothing in it. The portal has no row to draw. */
  | { status: "no-access" }
  /** A read failed. Nothing is known about the caller's capabilities, so nothing is assumed. */
  | { status: "unavailable" };
