import type { Tables } from "@clavehq/shared/types/database";

/**
 * One row of the announcement board's table: enough to draw the list, and nothing the list
 * doesn't show.
 *
 * Derived from the generated row type rather than re-declared — same reasoning as
 * `features/authz/types.ts`'s `Village` — so a column that changes shape in a migration reaches
 * this through the next `gen types` run instead of drifting quietly.
 */
export type AnnouncementListRow = Pick<
  Tables<"announcements">,
  "id" | "title" | "body" | "status" | "publish_at" | "created_at"
> & {
  /** How many rows `announcement_attachments` carries for this post, from the joined count. */
  attachmentCount: number;
  /**
   * The creator's display name, or `null` when there is none to show.
   *
   * `announcements.created_by` is `on delete set null` (see
   * `20260909120000_announcements.sql`), so a deleted account leaves a row with nobody to join —
   * that is a real, expected answer and not a failed read. This type only says what the query
   * found; the fallback copy ("Removed account") belongs to the component that renders it, not
   * to the data.
   */
  authorName: string | null;
};

/**
 * One stored attachment, as the edit page lists it.
 *
 * `storage_path` is here because it is what a download is minted from and what a removal names —
 * both server-side. It is not a URL and it is not secret: the bucket is private, so a path
 * without a signed URL reaches nothing (`20260909120000_announcements.sql`, Storage section).
 *
 * `checksum_sha256` and `created_by` are deliberately absent. Neither is drawn, and a column a
 * page does not show is a column it should not carry.
 */
export type AnnouncementAttachment = Pick<
  Tables<"announcement_attachments">,
  "id" | "file_name" | "mime_type" | "byte_size" | "storage_path"
>;

/**
 * One whole announcement: what the compose form loads for editing, and what the read-only view
 * draws, together with the files already attached to it.
 *
 * The attachments ride along rather than being fetched separately: they are read through the
 * parent's own embed in one round trip, and a page that could load an announcement but not its
 * files would be the state the board shipped with — an edit that keeps files it can neither list
 * nor take away.
 *
 * `created_at` and `authorName` are here for the view's "posted by / posted on" line and for
 * nothing else — the edit form has never drawn either. They arrive from the same embed the board
 * reads (`created_by(full_name, username)`), so the two surfaces name a person the same way; see
 * `AnnouncementListRow.authorName` above for why `null` is an answer rather than a failure.
 */
export type AnnouncementRecord = Pick<
  Tables<"announcements">,
  "id" | "title" | "body" | "status" | "publish_at" | "created_at"
> & {
  attachments: readonly AnnouncementAttachment[];
  authorName: string | null;
};
