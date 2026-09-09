import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can } from "@/features/authz/permissions";
import { loadAuthzContext } from "@/features/authz/server/context";
import { filledButton } from "@/features/brand/cta";
import { createSupabaseServerClient } from "@/features/auth/lib/server";
import {
  BoardFilter,
  type BoardFilterSegment,
} from "@/features/announcements/components/BoardFilter";
import { BoardPager, type PageSizeOption } from "@/features/announcements/components/BoardPager";
import { BoardTable } from "@/features/announcements/components/BoardTable";
import { EmptyState } from "@/features/announcements/components/EmptyState";
import {
  fetchAnnouncements,
  fetchAnnouncementStatusCounts,
} from "@/features/announcements/server/queries";
import {
  announcementDisplayStatus,
  type AnnouncementDisplayStatus,
} from "@/features/announcements/status";

export const metadata: Metadata = {
  title: "Announcements — claveHQ",
  // Stays with every authenticated route: an admin console has nothing for a search index.
  robots: { index: false, follow: false },
};

/**
 * The announcement board — a Server Component, and deliberately the only kind of component on
 * this page. The status filter and the pager are links, not client state (`docs/FRONTEND.md`
 * §1's leaf rule), so nothing here needs `"use client"`: the URL is the only state that exists.
 *
 * **Gated on `announcements.create`, not `.read`.** `announcements.read` is seeded to every
 * role — it is the future resident feed on mobile — so gating this admin console on it would put
 * the board in every owner and tenant's drawer. `.create` is `super_admin`, `hoa_admin` and
 * `officer` only, which is exactly this page's audience. A caller who lacks it gets `notFound()`,
 * a 404, so the route does not confirm its own existence to someone who cannot use it — the same
 * reasoning `features/portal/nav/destinations.ts` records for the drawer row this page sits
 * behind.
 *
 * The status filter and the pager are both database-side: `fetchAnnouncements` takes the derived
 * status and the requested page straight through to PostgREST's own `WHERE`/`.range()`, and
 * `fetchAnnouncementStatusCounts` answers the filter pills' counts (and, summed, the headline's
 * total) in one grouped read. Nothing here fetches more than one page's worth of rows to filter,
 * count or slice in memory — see both functions' doc comments in `server/queries.ts` for why that
 * matters past 1000 announcements ever posted, not just for how fast this page is today.
 */
export default async function AnnouncementsPage({ searchParams }: PageProps<"/announcements">) {
  const result = await loadAuthzContext();

  if (result.status === "signed-out") {
    redirect("/sign-in");
  }

  if (result.status !== "ok") {
    return null;
  }

  const { permissions, village } = result.context;

  if (!can(permissions, "announcements.create")) {
    notFound();
  }

  const params = await searchParams;
  const statusFilter = parseStatusFilter(params.status);
  const pageSize = parsePageSize(params.pageSize);
  const page = parsePage(params.page);

  // One instant, threaded through both reads — see `fetchAnnouncements`'s doc comment for why a
  // list and a count answered from two different `now`s could disagree at the scheduled/published
  // boundary.
  const now = new Date();
  const status = statusFilter === "all" ? undefined : statusFilter;

  const supabase = await createSupabaseServerClient();
  const [board, statusCounts] = await Promise.all([
    fetchAnnouncements(supabase, village.id, pageSize, page - 1, now, status),
    fetchAnnouncementStatusCounts(supabase, village.id, now),
  ]);

  if (board === null || statusCounts === null) {
    return (
      <main className="mx-auto w-full max-w-[1180px] px-[22px] pt-11 pb-14">
        <h2 className="headline-m text-on-surface">Announcements</h2>
        <p className="body-l mt-3 max-w-[62ch] text-on-surface-variant">
          The board could not be loaded. Reload the page; if it keeps happening, the database is the
          place to look.
        </p>
      </main>
    );
  }

  const rows = board.rows.map((row) => ({
    ...row,
    displayStatus: announcementDisplayStatus(row, now),
  }));

  const totalCount =
    statusCounts.draft + statusCounts.scheduled + statusCounts.published + statusCounts.archived;
  const pendingCount = statusCounts.draft + statusCounts.scheduled;

  // `board.totalCount` is `fetchAnnouncements`'s own `count: "exact"`, already scoped to the
  // current status filter — the pager's math, so a page requested past the end of that count
  // still links back to a real one instead of one computed from whatever this page happened to
  // fetch.
  const pageCount = Math.max(1, Math.ceil(board.totalCount / pageSize));
  const currentPage = page;

  const current = { status: statusFilter, page: currentPage, pageSize };

  const filters: BoardFilterSegment[] = FILTER_SEGMENTS.map((segment) => ({
    key: segment.key,
    label: segment.label,
    count: segment.key === "all" ? totalCount : statusCounts[segment.key],
    href: buildHref({ status: segment.key, page: 1 }, current),
    selected: segment.key === statusFilter,
  }));

  const pageSizeOptions: PageSizeOption[] = PAGE_SIZES.map((size) => ({
    value: size,
    href: buildHref({ pageSize: size, page: 1 }, current),
    selected: size === pageSize,
  }));

  const newAnnouncementButton = (
    <Link href="/announcements/new" className={`${filledButton} gap-2`}>
      <PlusGlyph />
      <span>New announcement</span>
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-[1180px] px-[22px] pt-11 pb-14">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="headline-m text-on-surface">{boardHeadline(totalCount, pendingCount)}</h2>
          <p className="body-l mt-2 max-w-[62ch] text-on-surface-variant">
            Drafts and scheduled posts are visible here and nowhere else. A resident sees a post the
            moment its publish time passes — there is no job to run and nothing to press.
          </p>
        </div>
        <div className="mt-1 shrink-0">{newAnnouncementButton}</div>
      </div>

      {totalCount === 0 ? (
        <div className="mt-9">
          <EmptyState variant="day-one" villageName={village.name} cta={newAnnouncementButton} />
        </div>
      ) : (
        <>
          <div className="mt-6 mb-4">
            <BoardFilter filters={filters} />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              variant="filtered"
              filterLabel={FILTER_SEGMENTS.find((s) => s.key === statusFilter)?.label ?? "matching"}
            />
          ) : (
            // No `overflow-hidden`: it would clip the rows-per-page menu, which opens upward
            // over the last rows because it is anchored to a control at the bottom of the card.
            // Nothing paints into the rounded corners without it — the header and the rows carry
            // no fill of their own, so the card's own `bg-surface` shows through underneath them.
            <div className="rounded-m border border-outline-variant bg-surface">
              <BoardTable rows={rows} />
              <BoardPager
                pageSizeOptions={pageSizeOptions}
                currentPageSize={pageSize}
                totalCount={board.totalCount}
                page={currentPage}
                pageCount={pageCount}
                firstHref={currentPage > 1 ? buildHref({ page: 1 }, current) : null}
                prevHref={currentPage > 1 ? buildHref({ page: currentPage - 1 }, current) : null}
                nextHref={
                  currentPage < pageCount ? buildHref({ page: currentPage + 1 }, current) : null
                }
                lastHref={currentPage < pageCount ? buildHref({ page: pageCount }, current) : null}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}

// --- URL state -------------------------------------------------------------------------------

type BoardFilterKey = "all" | AnnouncementDisplayStatus;

const FILTER_SEGMENTS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
] as const satisfies readonly { key: BoardFilterKey; label: string }[];

const PAGE_SIZES = [10, 50, 1000] as const;

const DEFAULT_STATUS: BoardFilterKey = "all";
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `find`, not `some`, and that is the whole point rather than a preference.
 *
 * `some` answers a boolean, which narrows nothing — the candidate is still `string`
 * afterwards, so returning it needs an assertion, and this project forbids those outright.
 * `find` carries the matched element out with its own type, so `segment.key` is already a
 * `BoardFilterKey` and the compiler follows the code instead of being told what to believe.
 *
 * `parsePageSize` below was written this way from the start; this one drifted.
 */
function parseStatusFilter(value: string | string[] | undefined): BoardFilterKey {
  const candidate = firstValue(value);
  const match = FILTER_SEGMENTS.find((segment) => segment.key === candidate);

  return match?.key ?? DEFAULT_STATUS;
}

function parsePageSize(value: string | string[] | undefined): (typeof PAGE_SIZES)[number] {
  const candidate = Number(firstValue(value));
  const match = PAGE_SIZES.find((size) => size === candidate);

  return match ?? DEFAULT_PAGE_SIZE;
}

function parsePage(value: string | string[] | undefined): number {
  const candidate = Number(firstValue(value));

  return Number.isInteger(candidate) && candidate >= 1 ? candidate : DEFAULT_PAGE;
}

/**
 * Every link on this page reduces to the same three-field state, so this is the one place that
 * turns state into a URL — a one-time operation kept inline rather than a query-string module
 * with a single caller. A default value is left off the query string entirely, so the plain
 * `/announcements` a fresh visit lands on is also the URL every "back to default" link points at.
 */
function buildHref(
  overrides: Partial<{ status: BoardFilterKey; page: number; pageSize: number }>,
  current: { status: BoardFilterKey; page: number; pageSize: number },
): string {
  const status = overrides.status ?? current.status;
  const page = overrides.page ?? current.page;
  const pageSize = overrides.pageSize ?? current.pageSize;

  const params = new URLSearchParams();
  if (status !== DEFAULT_STATUS) params.set("status", status);
  if (page !== DEFAULT_PAGE) params.set("page", String(page));
  if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize));

  const query = params.toString();

  return query === "" ? "/announcements" : `/announcements?${query}`;
}

/** "118 announcements, and two have not gone out yet." — the design's own headline, generalised
 * to whatever the board actually holds rather than the canvas's fixture numbers. */
function boardHeadline(total: number, pending: number): string {
  const totalPhrase = `${total} announcement${total === 1 ? "" : "s"}`;

  if (pending === 0) {
    return `${totalPhrase}.`;
  }

  const pendingPhrase = pending === 1 ? "one has" : `${pending} have`;

  return `${totalPhrase}, and ${pendingPhrase} not gone out yet.`;
}

function PlusGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}
