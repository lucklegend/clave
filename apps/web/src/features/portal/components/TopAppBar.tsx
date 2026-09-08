import { ThemeToggle } from "@/features/theme/components/ThemeToggle";
import { NotificationsIcon, SearchIcon } from "../icons";
import { PORTAL_PAGES } from "../nav/destinations";
import { AccountButton } from "./AccountButton";
import { PageHeading } from "./PageHeading";

// The two controls the canvas draws that have nothing behind them yet. Same treatment as the
// drawer's planned destinations and for the same reason: `aria-disabled` rather than `disabled`
// keeps them in the tab order and announced, and 38% opacity is M3's disabled content. They are
// spelled out here instead of composing `iconButton` because that string carries `m3-state`, and
// a control that cannot act should not answer a hover as though it could.
const unbuiltIconButton =
  "inline-flex h-12 w-12 items-center justify-center rounded-full text-on-surface-variant " +
  "opacity-[0.38]";

type TopAppBarProps = {
  /** The signed-in person's display name, for the account avatar. */
  accountName: string | null;
};

/**
 * M3's small top app bar, 64px, over the same `surface` the content sits on.
 *
 * **No elevation and no divider**, which is the canvas's decision and not an omission: the bar
 * and the page below it are one surface, and the drawer's `surface-container-low` is the only
 * tonal step in the shell. It does not stick, so nothing scrolls under a bar with no boundary to
 * separate it.
 *
 * The `<h1>` is here rather than on each page, so the page's own heading structure starts at
 * `<h2>`. That is why the drawer's wordmark is a `<span>`. It reads the route for itself rather
 * than taking a title prop from the layout — see `PageHeading`, which is where the app bar stops
 * being a Server Component and why.
 */
export function TopAppBar({ accountName }: TopAppBarProps) {
  return (
    <header className="flex h-16 items-center gap-1 bg-surface pr-3 pl-4">
      <PageHeading titles={PORTAL_PAGES} />

      <button type="button" aria-disabled="true" aria-label="Search" className={unbuiltIconButton}>
        <SearchIcon />
      </button>

      <ThemeToggle />

      {/* The canvas puts a 6px `error` unread dot on this bell. It is deliberately not drawn:
          there is no notifications table, so the dot could only ever be permanently lit, and a
          badge that reports a state it cannot read is the same "looks live and isn't" the ticket
          refused fixtures for. It arrives with the count behind it. */}
      <button
        type="button"
        aria-disabled="true"
        aria-label="Notifications"
        className={unbuiltIconButton}
      >
        <NotificationsIcon />
      </button>

      <AccountButton name={accountName} />
    </header>
  );
}
