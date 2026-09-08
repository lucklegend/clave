import type { PermissionSet, Village } from "@/features/authz/types";
import { MenuIcon } from "../icons";
import { NAV_DESTINATIONS, type Destination } from "../nav/destinations";
import { groupBySection, visibleDestinations } from "../nav/select";
import { DestinationLink } from "./DestinationLink";
import { DrawerFrame } from "./DrawerFrame";
import { SidebarToggle } from "./SidebarToggle";
import { VillagePill } from "./VillagePill";

// The canvas's measurements, kept in one place because every row shares them: 56px tall, a 24px
// glyph 16px from the leading edge, 12px to the label, 24px of trailing padding, full round.
const rowBase = "flex h-14 w-full items-center gap-3 rounded-full pl-4 pr-6 label-l";

// The current destination takes **no state layer**, and it is worth knowing why before adding
// one back. `m3-state` mixes `currentColor` into `transparent`, which replaces a tonal fill
// rather than layering over it — on `secondary-container` a hover erases the fill. The obvious
// repair, compositing the on-colour over the fill the way `filledButton` does, has no contrast
// budget to spend: ticket 0004 measured `on-secondary-container` on `secondary-container` at
// 4.54 light / 4.52 dark, and an 8% layer of the on-colour drops the label to 4.13 / 3.93 —
// under the 4.5 floor that `label-l` at 14px/500 has to clear. The table is in
// `StatementCard.tsx`, which reached the same answer for its selected segment. Nothing is lost:
// this row is the page the reader is already on, so hover on it communicates nothing.
const rowActive = `${rowBase} bg-secondary-container text-on-secondary-container`;

const rowInactive = `${rowBase} text-on-surface-variant m3-state`;

// M3's disabled state is 38% opacity on the content, the same number `cta.ts` gives a disabled
// button. No `m3-state`: a row that cannot be followed should not answer a hover as though it
// could.
const rowPlanned = `${rowBase} text-on-surface-variant opacity-[0.38]`;

type NavigationDrawerProps = {
  village: Village;
  permissions: PermissionSet;
};

/**
 * M3's standard navigation drawer, 360px wide, and the portal's whole navigation surface.
 *
 * A Server Component. *Which* rows it draws is decided here, by the permission set the layout
 * resolved — neither that set nor the destination table is serialised to the browser, and making
 * this component a client one to find out which row is current would ship both. Which row *is*
 * current is the one question that cannot be answered here, because a layout is not re-rendered
 * on a soft navigation between two of its own routes; it is answered a level down, by
 * `DestinationLink`, from the URL alone.
 *
 * The `<nav>` itself, its width and whether it is collapsed belong to `DrawerFrame`, the client
 * frame this renders into: holding that boolean here would make this a client component and ship
 * `permissions` and the destination table with it.
 *
 * **Below `lg` the drawer is not rendered.** The canvas's answer at that width is a modal drawer
 * behind a menu button, which needs open/close state and is not part of this ticket; the desktop
 * drawer squeezed into a 375px viewport would be worse than either. What it costs today is
 * nothing but the village pill: ten of the eleven rows are unbuilt, and the eleventh is the page
 * a portal visitor is already on.
 */
export function NavigationDrawer({ village, permissions }: NavigationDrawerProps) {
  const groups = groupBySection(visibleDestinations(NAV_DESTINATIONS, permissions));

  return (
    <DrawerFrame>
      {/* The header row's padding is the canvas's 4px 8px 8px 4px rather than the wordmark's own
          former `px-4 pt-4 pb-2`: the 48px button is taller than the 28px wordmark, so the row
          tightens around it to leave the wordmark's baseline where it was. */}
      <div className="flex items-center gap-1 pt-1 pr-2 pb-2 pl-1">
        <SidebarToggle>
          <MenuIcon />
        </SidebarToggle>

        {/* The same wordmark the masthead sets, and a `<span>` for the same reason: the page's
            heading is the app bar's `<h1>`, and a second one here would give the portal two.
            `whitespace-nowrap` so it does not rewrap into two lines on its way to 0px. */}
        <span className="title-l whitespace-nowrap text-on-surface">
          clave<em className="not-italic text-primary">HQ</em>
        </span>
      </div>

      <VillagePill village={village} />

      {/* The canvas had `overflow: hidden` here and no scroll container, and the nav stack
          measures about 905px — so on a 900px-tall laptop the last destination was clipped with
          no way to reach it. `min-h-0` is the half that is easy to leave out: a flex child's
          default `min-height: auto` refuses to shrink below its content, and `overflow-y-auto`
          on a box that never shrinks never scrolls. */}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.key}>
            {group.heading === null ? (
              <hr className="mx-4 my-2 border-t border-outline-variant" />
            ) : (
              <h2 className="label-m flex h-9 items-center px-4 text-on-surface-variant">
                {group.heading}
              </h2>
            )}
            <ul>
              {group.destinations.map((destination) => (
                <li key={destination.label}>
                  <DestinationRow destination={destination} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </DrawerFrame>
  );
}

/**
 * One row: a link to a page that exists, or a focusable announcement of one that does not.
 *
 * `aria-disabled` and never the HTML `disabled` attribute. `disabled` takes the element out of
 * the tab order, which would leave a keyboard or screen-reader user unable to reach ten rows
 * that every sighted user can see — the roadmap is information, and hiding it from one group is
 * not the same page. `aria-disabled` announces the state and keeps the row reachable.
 *
 * It is a `<button>` rather than a `<span tabIndex={0}>` because a focusable element needs a
 * role to be announced as anything, and there is no such thing as a disabled link in HTML. It
 * carries no handler, so pressing it does nothing at all.
 *
 * The glyph and the label are handed to `DestinationLink` as children rather than as props, so
 * the icon component itself never has to cross the server/client boundary — a function is not
 * serialisable, and rendering it here keeps `icons.tsx` out of the browser bundle.
 */
function DestinationRow({ destination }: { destination: Destination }) {
  const { Icon } = destination;

  if (destination.kind === "planned") {
    return (
      <button type="button" aria-disabled="true" className={rowPlanned}>
        <Icon />
        {destination.label}
      </button>
    );
  }

  return (
    <DestinationLink
      href={destination.href}
      activeClassName={rowActive}
      inactiveClassName={rowInactive}
    >
      <Icon />
      {destination.label}
    </DestinationLink>
  );
}
