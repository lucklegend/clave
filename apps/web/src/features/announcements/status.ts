import type { Tables } from "@clavehq/shared/types/database";

/**
 * The status a person sees, as opposed to `public.announcement_status`, the three values the
 * column actually stores. This is the heart of the scheduling design (see
 * `20260909120000_announcements.sql`'s enum comment and the `AnnouncementsIcon` ADR once it
 * lands): the database never stores "scheduled". A row is `published` with a `publish_at` in the
 * future, and it becomes visible to residents — via the `announcements_select` RLS policy, not
 * via any code here — the instant that timestamp passes. "Scheduled" is the label a manager sees
 * for exactly that in-between state, computed fresh on every render rather than written down
 * anywhere, so there is no row that can go stale and no job that can fail to flip it.
 */
export type AnnouncementDisplayStatus = "draft" | "scheduled" | "published" | "archived";

/** The two columns the derivation reads, picked rather than redeclared. */
type AnnouncementScheduleFields = Pick<Tables<"announcements">, "status" | "publish_at">;

/**
 * Derive the display status of one announcement at one instant.
 *
 * `now` is a required parameter, not `new Date()` read inside the function, so the same row
 * produces the same answer for as long as the caller holds `now` fixed — a list rendered once
 * should not have some rows flip from "scheduled" to "published" mid-render because the clock
 * ticked between two calls, and a test should be able to assert the boundary exactly rather than
 * race the real clock. The caller decides what "now" means; this function only compares against
 * it.
 *
 * A `published` row with a null `publish_at` cannot occur under the
 * `announcements_publish_at_iff_published` check constraint, but the generated column type is
 * still `string | null` — a CHECK constraint isn't expressible in a TypeScript type — so that
 * case is handled here rather than assumed away: it renders as already-live, since there is no
 * future instant to compare against.
 */
export function announcementDisplayStatus(
  announcement: AnnouncementScheduleFields,
  now: Date,
): AnnouncementDisplayStatus {
  if (announcement.status !== "published") {
    return announcement.status;
  }

  if (announcement.publish_at === null) {
    return "published";
  }

  return new Date(announcement.publish_at) > now ? "scheduled" : "published";
}
