import Link from "next/link";
import type { AnnouncementListRow } from "../types";
import type { AnnouncementDisplayStatus } from "../status";
import { StatusBadge } from "./StatusBadge";

/**
 * The board itself: four columns — Announcement, Posted by, Status, Files — copying
 * `Announcements.dc.html` almost cell for cell. `StatementCard.tsx` is the precedent for a table
 * this codebase draws by hand (there is no `Table` component, and this ticket does not add one):
 * `label-m` headers on `border-b border-outline-variant`, `body-m`/`body-l` cells, and a plain
 * `<table>` rather than a div grid, because the content genuinely is tabular.
 *
 * **Row separators only, no vertical rules.** `<tbody>` carries `divide-y` instead of a
 * `border-b` on every `<td>`, which is what leaves the last row undivided from the pagination
 * footer below it without a second, doubled-up line.
 *
 * **The three metadata columns are fixed and right-aligned; the announcement takes the rest.**
 * 128px / 165px / 30px — the widths the design measured against a full name, a mono timestamp,
 * and a digit — are the exact figure a `<col>` carries, never eyeballed. Status and Files drop
 * their left inset (`pl-0`): both are right-aligned, so a left pad is dead space, and at 30px
 * for Files the default padding on both sides would out-measure the count it holds. That is
 * also why the paperclip glyph lives in the Files header and never in a cell — 30px cannot hold
 * a 16px icon and a 12px inset together.
 */

type BoardRow = AnnouncementListRow & { displayStatus: AnnouncementDisplayStatus };

type BoardTableProps = {
  rows: readonly BoardRow[];
};

const headCellClasses = "label-m border-b border-outline-variant py-3 text-on-surface-variant";

export function BoardTable({ rows }: BoardTableProps) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col />
        <col className="w-32" />
        <col className="w-[165px]" />
        <col className="w-[30px]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={`${headCellClasses} px-4 text-left`}>
            Announcement
          </th>
          <th scope="col" className={`${headCellClasses} px-4 text-right`}>
            Posted by
          </th>
          <th scope="col" className={`${headCellClasses} py-3 pr-4 pl-0 text-right`}>
            Status
          </th>
          <th scope="col" className={`${headCellClasses} py-3 pr-3 pl-0 text-right`}>
            {/* The glyph carries the column's meaning to everyone else; the column's own name
                still has to reach a screen reader, since a bare paperclip announces nothing. */}
            <FilesGlyph />
            <span className="sr-only">Files</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-outline-variant">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3.5">
              <Link
                href={`/announcements/${row.id}/edit`}
                className="body-l block truncate text-on-surface hover:underline"
              >
                {row.title}
              </Link>
              <span className="body-m mt-0.5 block truncate text-on-surface-variant">
                {row.body}
              </span>
            </td>
            <td className="px-4 py-3.5 text-right">
              <span className="body-m block truncate text-on-surface-variant">
                {row.authorName ?? "Removed account"}
              </span>
            </td>
            <td className="py-3.5 pr-4 pl-0 text-right">
              <StatusBadge status={row.displayStatus} publishAt={row.publish_at} />
            </td>
            <td className="py-3.5 pr-3 pl-0 text-right">
              <span className="body-m num text-on-surface-variant">
                {row.attachmentCount > 0 ? row.attachmentCount : "—"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The paperclip, 16px, hand-authored on the same precedent `StatusBadge.tsx`'s glyphs are — this
// one transcribed from the design's own header icon rather than from Material Symbols, since the
// icon font is subset to the eleven nav glyphs and a twelfth codepoint here would render as tofu.
function FilesGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="ml-auto size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16.5 8.5 10 15a2.5 2.5 0 0 1-3.5-3.5l7.2-7.2a4 4 0 0 1 5.6 5.6L11.5 17.7" />
    </svg>
  );
}
