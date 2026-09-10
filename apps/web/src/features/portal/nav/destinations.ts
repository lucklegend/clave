import type { JSX } from "react";
import type { PermissionKey } from "@clavehq/shared";
import {
  AmenitiesIcon,
  AnnouncementsIcon,
  BillingIcon,
  BookingsIcon,
  DashboardIcon,
  PaymentsIcon,
  ReportsIcon,
  ResidentsIcon,
  RolesAndAccessIcon,
  SettingsIcon,
  UnitsIcon,
} from "../icons";

/**
 * Every portal page that exists, with the title its app bar carries.
 *
 * Deliberately a different list from {@link NAV_DESTINATIONS} below, and the two are not going
 * to converge: a drawer row can name a module with no page behind it yet (nine of the eleven do
 * today), and a page can exist with no drawer row (`/settings` is the account page, reached from
 * the app bar's account button — the drawer's "Settings" row is the unbuilt *village* settings
 * module, which is a different screen with a different gate).
 *
 * It is also what makes {@link Destination}'s `href` safe. Typed routes do not reach `<Link>`'s
 * `href` in this configuration — Next 16.3.4 generates `.next/types/routes.d.ts` and validates
 * page and layout *exports* against it, but nothing there re-types `href`, so `href="/nope"`
 * compiles. Deriving {@link PortalRoute} from these keys gives the guarantee the plan wanted
 * from typed routes: a built destination can only point at a page listed here, and listing one
 * is what you do when you add the page.
 */
export const PORTAL_PAGES = {
  "/dashboard": "Today",
  "/settings": "Settings",
  "/announcements": "Announcements",
  "/announcements/new": "New announcement",
} as const;

/**
 * Titles for portal routes whose path carries an id, which {@link PORTAL_PAGES} cannot name.
 *
 * Kept separate rather than folded in, because the two tables do different jobs.
 * `PORTAL_PAGES` is a record of literal paths and that is what makes `PortalRoute` a union a
 * `<Link href>` can be typechecked against; a pattern has no literal path to offer, so adding
 * one there would widen `PortalRoute` to `string` and quietly give up the guarantee the
 * record exists for.
 *
 * Patterns are strings, not `RegExp`, because this table crosses the server/client boundary
 * to reach `PageHeading` and a `RegExp` does not serialise. The consumer compiles them.
 *
 * Ordered: the first match wins, and `PORTAL_PAGES` is consulted first, so an exact route
 * like `/announcements/new` never reaches a pattern that would also match it.
 */
export const PORTAL_PAGE_PATTERNS = [
  { pattern: "^/announcements/view/[^/]+/edit$", title: "Edit announcement" },
  // After the edit pattern, and the order is load-bearing: first match wins, and
  // `[^/]+` would otherwise swallow `/announcements/view/<id>/edit` on its way past.
  { pattern: "^/announcements/view/[^/]+$", title: "Announcement" },
] as const satisfies readonly { pattern: string; title: string }[];

export type PortalRoute = keyof typeof PORTAL_PAGES;

/**
 * The drawer's sections, in the order they are drawn.
 *
 * A `null` heading is the trailing group the canvas separates with a rule instead of a label —
 * one field decides both, so a group cannot end up with a heading *and* a rule.
 */
export const NAV_SECTIONS = [
  { key: "overview", heading: "Overview" },
  { key: "community", heading: "Community" },
  { key: "money", heading: "Money" },
  { key: "operations", heading: "Operations" },
  { key: "system", heading: null },
] as const;

export type NavSectionKey = (typeof NAV_SECTIONS)[number]["key"];

type DestinationCommon = {
  label: string;
  section: NavSectionKey;
  /** The 24px glyph, from `features/portal/icons.tsx`. Every one is `aria-hidden` by construction. */
  Icon: () => JSX.Element;
  /**
   * The capability that reveals this row, or `null` for a row every member of a village sees.
   *
   * This axis **hides**; `kind` below **disables**. They are independent on purpose: a row you
   * lack the capability for should not advertise itself, while a row that is merely unbuilt is
   * the roadmap and stays visible.
   */
  requires: PermissionKey | null;
};

/**
 * A drawer row, discriminated on whether the page behind it exists.
 *
 * A `planned` destination carries **no `href` at all**, which is the point of the union rather
 * than a `disabled: true` flag beside an optional one: there is no field to fill in, so an
 * unbuilt destination cannot acquire a link by someone adding an href and forgetting to flip a
 * boolean. The drawer's renderer branches on `kind` and only the `built` arm can reach `href`.
 */
export type Destination =
  | (DestinationCommon & { kind: "built"; href: PortalRoute })
  | (DestinationCommon & { kind: "planned" });

/**
 * The eleven destinations, in drawer order.
 *
 * **Two are built and nine are planned, and that is the two-axis rule working rather than a bug.**
 * Ticket 0007 ships the shell and Today, ticket 0010 ships Announcements; residents, units,
 * payments, billing, amenities, bookings and reports have no tables yet, and the last two are
 * their own tickets.
 *
 * The gates are the `read` key of the thing each row leads to, which leaves three that were open
 * questions when this was planned and are settled here:
 *
 *   * **Today is ungated.** Gating it on `villages.read` would hide the portal's landing page
 *     from someone the village has already admitted, and they would arrive at the shell with no
 *     row to stand on.
 *   * **Settings gates on `users.manage`, not `villages.manage`.** `villages.manage` is seeded
 *     to `super_admin` alone (`20260906120100_seed_roles_and_permissions.sql`), so gating on it
 *     would hide a village's own settings from the village administrator who runs it, while
 *     `users.manage` is the key that migration names as "what makes a village admin".
 *   * **Announcements gates on `announcements.create`, not `announcements.read`** — see the
 *     comment on that entry below for why.
 */
export const NAV_DESTINATIONS = [
  {
    kind: "built",
    href: "/dashboard",
    label: "Today",
    section: "overview",
    Icon: DashboardIcon,
    requires: null,
  },
  {
    kind: "built",
    href: "/announcements",
    label: "Announcements",
    section: "community",
    Icon: AnnouncementsIcon,
    // Gated on `.create`, not `.read`, and this is the first row where the two diverge.
    // `announcements.read` is seeded to every role (`20260906120100_seed_roles_and_permissions.sql`)
    // because it is the resident feed the mobile app will read from — gating this admin console
    // on it would put "Announcements" in every owner, tenant, maintenance and guard's drawer.
    // `announcements.create` is held only by super_admin, hoa_admin and officer, which is exactly
    // who this board is for.
    requires: "announcements.create",
  },
  {
    kind: "planned",
    label: "Residents",
    section: "community",
    Icon: ResidentsIcon,
    requires: "users.read",
  },
  {
    kind: "planned",
    label: "Units",
    section: "community",
    Icon: UnitsIcon,
    requires: "units.read",
  },
  {
    kind: "planned",
    label: "Payments",
    section: "money",
    Icon: PaymentsIcon,
    requires: "payments.read",
  },
  {
    kind: "planned",
    label: "Billing",
    section: "money",
    Icon: BillingIcon,
    requires: "billing.read",
  },
  {
    kind: "planned",
    label: "Amenities",
    section: "operations",
    Icon: AmenitiesIcon,
    requires: "amenities.read",
  },
  {
    kind: "planned",
    label: "Bookings",
    section: "operations",
    Icon: BookingsIcon,
    requires: "bookings.read",
  },
  {
    kind: "planned",
    label: "Reports",
    section: "operations",
    Icon: ReportsIcon,
    requires: "reports.read",
  },
  {
    kind: "planned",
    label: "Settings",
    section: "system",
    Icon: SettingsIcon,
    requires: "users.manage",
  },
  {
    kind: "planned",
    label: "Roles & access",
    section: "system",
    Icon: RolesAndAccessIcon,
    requires: "roles.read",
  },
] as const satisfies readonly Destination[];
