import "server-only";

import type { createSupabaseServerClient } from "@/features/auth/lib/server";
import type { AnnouncementDisplayStatus } from "../status";
import type { AnnouncementListRow, AnnouncementRecord } from "../types";

/**
 * The reads behind the announcement board: the paginated list, its per-status counts, and the
 * single-row lookup the edit page uses. Copies the shape of `features/authz/server/queries.ts`
 * precisely — read that file's top comment first, because the two reasons it gives apply here
 * without change.
 *
 * Every function takes the Supabase client as a **parameter** rather than building one. That is
 * this repo's injection seam: a caller can see which client a read runs as, and these reads can
 * be exercised with a stub client once a test runner exists.
 *
 * `import "server-only"` for the same reason `features/auth/server/resolve-identifier.ts` and
 * `features/authz/server/queries.ts` carry it: a client component that imported these would ship
 * the reads into the browser, and the bundler should refuse that rather than leave it to review.
 *
 * **Every function returns `null` on a failed read, and never an empty result.** "The database is
 * down" and "there are no announcements" are different claims about the world, and a component
 * that cannot tell them apart renders an outage as an empty board — see the `AuthzResult` doc
 * comment in `features/authz/types.ts` for the fuller version of this argument.
 *
 * None of these functions filters by capability. `announcements_select`, in
 * `20260909120000_announcements.sql`, is where the scheduling rule and the manager-sees-drafts
 * rule both live, and a `village_id` filter below is a convenience that picks which village's
 * board to draw — never the enforcement. `announcement_status_counts` (the SQL function behind
 * `fetchAnnouncementStatusCounts`) is `security invoker` for the same reason: it runs under the
 * caller's own role, so it inherits that same policy rather than restating it. Someone who should
 * not see a row does not get one back, or counted, no matter what these functions ask for.
 */

/** The client `features/auth/lib/server.ts` builds per request, derived so the two cannot disagree. */
type PortalClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * The three page sizes the board is allowed to render. Not user-configurable beyond this set: an
 * unbounded page size is a cheap way to make the server assemble and render arbitrarily much
 * HTML from a single request, so a size that arrives from outside this module (a query string,
 * eventually) is validated against this list rather than trusted and handed straight to
 * `.range()`.
 */
const ANNOUNCEMENT_PAGE_SIZES = [10, 50, 1000] as const;

type AnnouncementPageSize = (typeof ANNOUNCEMENT_PAGE_SIZES)[number];

function isAllowedPageSize(size: number): size is AnnouncementPageSize {
  return (ANNOUNCEMENT_PAGE_SIZES as readonly number[]).includes(size);
}

/** One page of the announcement board, plus the total row count the pager needs to draw "1 / N". */
export type AnnouncementPage = {
  rows: readonly AnnouncementListRow[];
  totalCount: number;
};

/**
 * One page of `villageId`'s announcement board, newest-scheduled-and-drafts-first, optionally
 * narrowed to one derived status.
 *
 * `publish_at desc nulls first, created_at desc` is the order a manager's workspace wants: a
 * draft carries no `publish_at` at all, so it sorts to the very top regardless of when it was
 * created, ahead of even a post scheduled far in the future; everything else then falls by how
 * soon it is (or was) due, newest first. `announcements_village_publish_idx` is built to answer
 * this exact ordering as an index scan.
 *
 * `pageSize` is validated rather than trusted — see `ANNOUNCEMENT_PAGE_SIZES` above — and an
 * unrecognised value falls back to the smallest page rather than failing the read, because an
 * invalid page size is a caller mistake, not evidence the database is unreachable.
 *
 * The attachment count and the author's name are joined rather than fetched separately, so the
 * list is one round trip instead of N+1: `announcement_attachments(count)` aggregates the child
 * table per row, and `created_by(full_name, username)` follows the same foreign key the guard
 * trigger in the migration protects.
 *
 * `status`, when given, filters on the *derived* status — `scheduled` and `published` are both
 * `status = 'published'` in the stored column, split only by comparing `publish_at` against
 * `now`, the same comparison `status.ts`'s `announcementDisplayStatus` makes and
 * `announcements_select` makes again at the row level. Filtering here means PostgREST turns it
 * into a `WHERE`, so a page 1000 rows into an archived board is still one index-backed read,
 * never "fetch everything, then filter in JS" — the escape hatch this file's page size list still
 * names is for a caller who genuinely wants the whole board, not the default path.
 *
 * `now` is a parameter rather than read inside this function, for the same reason
 * `announcementDisplayStatus` takes it as one: a caller drawing both this list and
 * `fetchAnnouncementStatusCounts` in the same request passes one instant to both, so "scheduled"
 * cannot mean two different cutoffs six lines apart.
 */
export async function fetchAnnouncements(
  client: PortalClient,
  villageId: string,
  pageSize: number,
  pageIndex: number,
  now: Date,
  status?: AnnouncementDisplayStatus,
): Promise<AnnouncementPage | null> {
  const size = isAllowedPageSize(pageSize) ? pageSize : 10;
  const from = pageIndex * size;
  const to = from + size - 1;
  const nowIso = now.toISOString();

  let query = client
    .from("announcements")
    .select(
      "id, title, body, status, publish_at, created_at, announcement_attachments(count), created_by(full_name, username)",
      { count: "exact" },
    )
    .eq("village_id", villageId);

  if (status === "draft" || status === "archived") {
    query = query.eq("status", status);
  } else if (status === "scheduled") {
    query = query.eq("status", "published").gt("publish_at", nowIso);
  } else if (status === "published") {
    query = query.eq("status", "published").lte("publish_at", nowIso);
  }

  const { data, error, count } = await query
    .order("publish_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error !== null || count === null) {
    return null;
  }

  const rows = data.map((row) => {
    const attachmentCount = row.announcement_attachments.at(0)?.count ?? 0;
    const authorName = row.created_by?.full_name ?? row.created_by?.username ?? null;

    return {
      id: row.id,
      title: row.title,
      body: row.body,
      status: row.status,
      publish_at: row.publish_at,
      created_at: row.created_at,
      attachmentCount,
      authorName,
    } satisfies AnnouncementListRow;
  });

  return { rows, totalCount: count };
}

/**
 * One announcement by id, for the edit page, the read-only view and the two file routes behind it.
 *
 * Wrapped in `{ row: ... }` rather than returned bare, the same way `fetchHomeVillageId` wraps
 * its answer in `features/authz/server/queries.ts`: `null` here already has a meaning (the read
 * failed), so "no row with this id is visible to the caller" — a normal outcome for a stale link,
 * a deleted post, or someone else's village, and not distinguishable from any of those without
 * leaking which — has to be a different value. `{ row: null }` is that value; the edit page reads
 * it and calls `notFound()`, the same way it would for any other id it cannot show.
 *
 * The attachments come back with it, embedded rather than read separately: the edit page draws a
 * download link and a remove control for each one, and two round trips would let the row and its
 * files be answered by two different states of the database. `announcement_attachments_select`
 * delegates its visibility to this very row's policy, so an embed cannot return a file belonging
 * to an announcement the caller could not have read in the first place — and the columns asked
 * for are the four the page draws plus the `storage_path` it mints a signed URL from. The
 * checksum stays out: it is written for a future integrity check, not for a list.
 *
 * Oldest attachment first, so the list does not reorder itself between two renders of a page
 * whose whole purpose is to point at one row of it.
 *
 * `created_at` and the author embed are read here rather than by a second query the view makes on
 * its own: "posted by X on Y" is one sentence about this row, and a sentence assembled from two
 * round trips can be assembled from two different states of the database. The embed is the same
 * one `fetchAnnouncements` uses — `created_by(full_name, username)`, following the foreign key the
 * migration's guard trigger protects — so the board and the view resolve a name identically, and
 * both answer `null` for an account that has since been deleted (`created_by` is
 * `on delete set null`), which is a fact about the row and not a failed read.
 */
export async function fetchAnnouncementById(
  client: PortalClient,
  id: string,
): Promise<{ row: AnnouncementRecord | null } | null> {
  const { data, error } = await client
    .from("announcements")
    // One literal, however long: `supabase-js` parses this string in the type system to give
    // `data` its shape, and a value assembled by concatenation is a string it cannot read.
    .select(
      "id, title, body, status, publish_at, created_at, created_by(full_name, username), announcement_attachments(id, file_name, mime_type, byte_size, storage_path)",
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "announcement_attachments", ascending: true })
    .maybeSingle();

  if (error !== null) {
    return null;
  }

  if (data === null) {
    return { row: null };
  }

  const { announcement_attachments, created_by, ...announcement } = data;

  return {
    row: {
      ...announcement,
      attachments: announcement_attachments,
      authorName: created_by?.full_name ?? created_by?.username ?? null,
    } satisfies AnnouncementRecord,
  };
}

/** How many of `villageId`'s announcements carry each derived status, all four in one row set. */
export type AnnouncementStatusCounts = Record<AnnouncementDisplayStatus, number>;

/** The four keys `AnnouncementStatusCounts` always carries, and the only ones the RPC can answer. */
const DISPLAY_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const satisfies readonly AnnouncementDisplayStatus[];

function isDisplayStatus(value: string): value is AnnouncementDisplayStatus {
  return (DISPLAY_STATUSES as readonly string[]).includes(value);
}

/**
 * How many of `villageId`'s announcements carry each derived status — draft, scheduled,
 * published, archived — for the filter pills, and their sum for the board's own headline.
 *
 * One round trip to `public.announcement_status_counts`, not five. PostgREST can express a
 * grouped count directly (`select=status,count()`), but that feature is switched off on this
 * stack — confirmed against the local instance, not assumed: it answers `PGRST123 Use of
 * aggregate functions is not allowed`, and `db-aggregates-enabled` is not a setting the Supabase
 * CLI's `config.toml` exposes to turn back on. A SQL function is the next-cheapest correct
 * instrument: still one round trip, and its result is four rows no matter how large the board
 * grows, unlike fetching every row to count them in JS.
 *
 * `now` is threaded straight through to the RPC's `p_now`, so the "scheduled" cutoff this
 * function answers with agrees with whatever `fetchAnnouncements` answered with for the same
 * `now` — see that function's doc comment for why a shared instant matters here.
 */
export async function fetchAnnouncementStatusCounts(
  client: PortalClient,
  villageId: string,
  now: Date,
): Promise<AnnouncementStatusCounts | null> {
  const { data, error } = await client.rpc("announcement_status_counts", {
    p_village: villageId,
    p_now: now.toISOString(),
  });

  if (error !== null) {
    return null;
  }

  const counts: AnnouncementStatusCounts = { draft: 0, scheduled: 0, published: 0, archived: 0 };

  for (const row of data) {
    if (isDisplayStatus(row.status)) {
      counts[row.status] = row.total;
    }
  }

  return counts;
}
