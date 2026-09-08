import { can } from "@/features/authz/permissions";
import type { PermissionSet } from "@/features/authz/types";
import { NAV_SECTIONS, type Destination, type NavSectionKey } from "./destinations";

/**
 * The two questions the drawer asks of its table on the server, as pure functions: which rows
 * this caller may see, and how they group.
 *
 * The third — which row is the page being rendered — is not here, because it cannot be answered
 * on the server and stay right: the portal layout does not re-render on a soft navigation. It
 * lives in `components/DestinationLink.tsx`, which reads the URL in the browser and has the
 * matching rule with it.
 *
 * No I/O, no React, no `server-only` — the whole file is data in, data out. `CODE_STANDARDS.md`
 * §6 names role-based access checks as one of the money paths that earn tests first, and this is
 * the half of the check that a test runner could drive without a database behind it.
 */

/** One section's heading and the rows that survived {@link visibleDestinations}. */
export type DestinationGroup = {
  key: NavSectionKey;
  /** `null` for the trailing group the drawer separates with a rule instead of a heading. */
  heading: string | null;
  destinations: readonly Destination[];
};

/**
 * The rows `permissions` clears, in table order.
 *
 * A destination with `requires: null` is shown to everyone the portal has already let in. Every
 * other row is hidden outright rather than dimmed: the drawer's own design copy is "a row only
 * appears if you hold the capability that clears it", and a dimmed row still discloses that the
 * module exists and that this account is not trusted with it.
 */
export function visibleDestinations(
  destinations: readonly Destination[],
  permissions: PermissionSet,
): readonly Destination[] {
  return destinations.filter(
    (destination) => destination.requires === null || can(permissions, destination.requires),
  );
}

/**
 * `destinations` split into the drawer's sections, in {@link NAV_SECTIONS} order.
 *
 * A section whose rows were all hidden is dropped rather than left as an empty heading — for the
 * trailing group that also drops its rule, so a resident who holds neither `users.manage` nor
 * `roles.read` gets no orphan hairline at the bottom of the drawer.
 */
export function groupBySection(destinations: readonly Destination[]): readonly DestinationGroup[] {
  return NAV_SECTIONS.map((section) => ({
    key: section.key,
    heading: section.heading,
    destinations: destinations.filter((destination) => destination.section === section.key),
  })).filter((group) => group.destinations.length > 0);
}
