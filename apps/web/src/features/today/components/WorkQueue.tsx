import type { PermissionKey } from "@clavehq/shared";
import { can } from "@/features/authz/permissions";
import type { PermissionSet } from "@/features/authz/types";
import { ChevronRightIcon } from "@/features/portal/icons";

type QueueRow = {
  label: string;
  /**
   * The capability that reveals this row — and, printed under the label, the row's own subtitle.
   * The design's distinctive move is that a queue names the gate that cleared it, so an officer
   * who cannot see a row can be told which key to ask for by name.
   */
  requires: PermissionKey;
};

/**
 * The four buckets, in the canvas's order.
 *
 * Every one of them counts nothing today, and there is deliberately no `count` field to hold a
 * number: `reports`, `billing`, `payments` and `bookings` have no tables yet, so there is no
 * query to run and nothing that could return a figure. The em-dash below is not a zero and not a
 * loading state — it is "this cannot be counted yet". A `count: 0` here would be the fixture the
 * ticket refused.
 */
const QUEUE_ROWS = [
  { label: "Incident reports to assign", requires: "reports.assign" },
  { label: "Accounts in arrears", requires: "billing.read" },
  { label: "Receipts to verify", requires: "payments.verify" },
  { label: "Bookings to approve", requires: "bookings.approve" },
] as const satisfies readonly QueueRow[];

// The canvas's row: 72px tall, a 24px trailing pad against a 16px leading one, 16px between the
// three things in it.
const rowClasses = "flex h-18 items-center gap-4 py-2 pr-6 pl-4";

// The count token is a fill behind mono figures, so its text colour is named rather than
// inherited: `on-secondary-container` on `secondary-container` measures 4.54 light / 4.52 dark
// (ticket 0004's table, quoted in `StatementCard.tsx`), which clears the 4.5 floor with 0.04 to
// spare — and spends all of it if anything ever composites a state layer on top. Nothing here
// does: the row is not a control, so it carries no `m3-state`.
//
// `error-container` is reserved for the urgent bucket and is not used on this page. Urgency is a
// property of a count, and no row here has one; tinting a bucket red before it can say how many
// items are overdue would be the same "looks live and isn't" the ticket refused fixtures for.
const countTokenClasses =
  "num title-m flex size-10 shrink-0 items-center justify-center rounded-full " +
  "bg-secondary-container text-on-secondary-container";

type WorkQueueProps = {
  /** Resolved by `(portal)/layout.tsx` and re-read here through `loadAuthzContext`'s memo. */
  permissions: PermissionSet;
};

/**
 * What is waiting on the person reading the page — or, today, the honest report that nothing is.
 *
 * **A row appears only if the viewer holds the key it names.** That is the same rule the drawer
 * applies to a destination and it is enforced the same way, through `can()` against the permission
 * set the layout resolved: hidden outright rather than dimmed, because a dimmed row still tells a
 * resident that receipts are waiting somewhere and that they are not trusted with them.
 */
export function WorkQueue({ permissions }: WorkQueueProps) {
  const rows = QUEUE_ROWS.filter((row) => can(permissions, row.requires));

  return (
    <div className="rounded-m border border-outline-variant bg-surface py-2">
      {rows.length === 0 ? (
        <p className="body-l px-4 py-3 text-on-surface-variant">
          Nothing is waiting on you. The queues that would appear here — reports, arrears, receipts
          and bookings — each need a capability this account does not hold in this village.
        </p>
      ) : (
        <>
          <ul>
            {rows.map((row) => (
              <li key={row.requires} className={rowClasses}>
                {/* The dash is decorative and the sentence beside it is what gets announced: an
                    em dash is read as anything from "em dash" to silence depending on the screen
                    reader and its punctuation setting, and none of those readings is "none". */}
                <span aria-hidden="true" className={countTokenClasses}>
                  —
                </span>
                <span className="sr-only">None waiting.</span>

                <span className="min-w-0 flex-1">
                  <span className="body-l block truncate text-on-surface">{row.label}</span>
                  <span className="num body-m block truncate text-on-surface-variant">
                    {row.requires}
                  </span>
                </span>

                {/* 38% opacity, M3's disabled content, on the same reasoning the drawer's planned
                    destinations use it: the chevron is a disclosure with no page behind it yet.
                    Drawn at full strength it would promise a link that does not exist; dropped
                    entirely, the row would not read as the queue it becomes. */}
                <span className="shrink-0 text-on-surface-variant opacity-[0.38]">
                  <ChevronRightIcon />
                </span>
              </li>
            ))}
          </ul>

          {/* Shown because every row above counts nothing, which today is every row there is. It
              sits under the list rather than replacing it: the rows are what this account may
              act on, and that is worth seeing even while each of them is empty. */}
          <p className="body-m mt-2 border-t border-outline-variant px-4 pt-3 text-on-surface-variant">
            Nothing is waiting on you. Each queue starts counting when the module behind it ships.
          </p>
        </>
      )}
    </div>
  );
}
